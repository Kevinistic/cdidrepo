"""
Fetch Roblox thumbnails for all cars and update the database with image URLs.
This script handles rate limiting and batches requests to the Roblox API.
"""

import json
import time
import re
from pathlib import Path
from collections import deque
from typing import Deque, Dict, List, Optional
import urllib.request
import urllib.error

BATCH_SIZE = 100  # Max asset IDs per request
REQUEST_DELAY = 1.0  # Delay between requests in seconds
THUMBNAIL_SIZE = "250x250"
MAX_PENDING_RETRIES = 5

def extract_asset_id(asset_url: str) -> Optional[str]:
    """Extract asset ID from rbxassetid:// or roblox.com/asset/?id= URL."""
    if not asset_url or not isinstance(asset_url, str):
        return None
    match = re.search(r'rbxassetid://(\d+)', asset_url)
    if match:
        return match.group(1)
    match = re.search(r'roblox\.com/asset/\?id=(\d+)', asset_url)
    return match.group(1) if match else None

def fetch_thumbnails(asset_ids: List[str]) -> Dict[str, str]:
    """Fetch thumbnails from Roblox API in batches with pending-item requeue."""
    results = {}
    next_index = 0
    batch_number = 0
    pending_queue: Deque[str] = deque()
    retry_counts: Dict[str, int] = {}

    while next_index < len(asset_ids) or pending_queue:
        batch: List[str] = []

        while pending_queue and len(batch) < BATCH_SIZE:
            batch.append(pending_queue.popleft())

        new_items_in_batch = 0
        while next_index < len(asset_ids) and len(batch) < BATCH_SIZE:
            batch.append(asset_ids[next_index])
            next_index += 1
            new_items_in_batch += 1

        if not batch:
            break

        batch_number += 1
        url = f"https://thumbnails.roblox.com/v1/assets?assetIds={','.join(batch)}&returnPolicy=PlaceHolder&size={THUMBNAIL_SIZE}&format=Png&isCircular=false"

        print(
            f"Fetching batch {batch_number} ({len(batch) - new_items_in_batch} retries + {new_items_in_batch} new, {len(batch)} total assets)..."
        )

        seen_in_response = set()
        retry_next_batch: List[str] = []
        
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())

                if data and 'data' in data:
                    for item in data['data']:
                        asset_id = str(item['targetId'])
                        seen_in_response.add(asset_id)
                        if item['state'] == 'Completed':
                            results[asset_id] = item['imageUrl']
                            retry_counts.pop(asset_id, None)
                        else:
                            retry_count = retry_counts.get(asset_id, 0) + 1
                            retry_counts[asset_id] = retry_count

                            if retry_count <= MAX_PENDING_RETRIES:
                                print(
                                    f"  Pending: Asset {asset_id} state is {item['state']} (retry {retry_count}/{MAX_PENDING_RETRIES})"
                                )
                                retry_next_batch.append(asset_id)
                            else:
                                print(
                                    f"  Warning: Asset {asset_id} state is {item['state']} after {MAX_PENDING_RETRIES} retries; marking as failed"
                                )
                                results[asset_id] = None

                missing_asset_ids = [asset_id for asset_id in batch if asset_id not in seen_in_response]
                for asset_id in missing_asset_ids:
                    retry_count = retry_counts.get(asset_id, 0) + 1
                    retry_counts[asset_id] = retry_count

                    if retry_count <= MAX_PENDING_RETRIES:
                        print(
                            f"  Pending: Asset {asset_id} missing in response (retry {retry_count}/{MAX_PENDING_RETRIES})"
                        )
                        retry_next_batch.append(asset_id)
                    else:
                        print(
                            f"  Warning: Asset {asset_id} missing after {MAX_PENDING_RETRIES} retries; marking as failed"
                        )
                        results[asset_id] = None

                print(f"  Fetched {len(batch)} thumbnails")

        except urllib.error.HTTPError as e:
            print(f"  HTTP Error {e.code}: {e.reason}")
            for asset_id in batch:
                retry_count = retry_counts.get(asset_id, 0) + 1
                retry_counts[asset_id] = retry_count

                if retry_count <= MAX_PENDING_RETRIES:
                    retry_next_batch.append(asset_id)
                else:
                    print(
                        f"  Warning: Asset {asset_id} failed after {MAX_PENDING_RETRIES} retries due to repeated HTTP errors"
                    )
                    results[asset_id] = None
        except Exception as e:
            print(f"  Error: {e}")
            for asset_id in batch:
                retry_count = retry_counts.get(asset_id, 0) + 1
                retry_counts[asset_id] = retry_count

                if retry_count <= MAX_PENDING_RETRIES:
                    retry_next_batch.append(asset_id)
                else:
                    print(
                        f"  Warning: Asset {asset_id} failed after {MAX_PENDING_RETRIES} retries due to repeated errors"
                    )
                    results[asset_id] = None

        if retry_next_batch:
            pending_queue.extend(retry_next_batch)

        # Rate limiting delay
        if next_index < len(asset_ids) or pending_queue:
            time.sleep(REQUEST_DELAY)

    return results

def main():
    # Load the combined cars database
    db_path = Path(__file__).parent / "docs" / "database" / "cars_combined.json"
    
    if not db_path.exists():
        print(f"Error: Database not found at {db_path}")
        return
    
    print(f"Loading database from {db_path}...")
    with open(db_path, 'r', encoding='utf-8') as f:
        cars_data = json.load(f)
    
    print(f"Found {len(cars_data)} cars")

    # Collect all unique asset IDs
    asset_ids_to_fetch = set()

    for car_key, car_data in cars_data.items():
        # Car image
        if 'CarImage' in car_data:
            car_image_id = extract_asset_id(car_data['CarImage'])
            if car_image_id:
                asset_ids_to_fetch.add(car_image_id)

        # Rims
        if 'Rims' in car_data:
            rims_id = extract_asset_id(car_data['Rims'])
            if rims_id:
                asset_ids_to_fetch.add(rims_id)

    print(f"Found {len(asset_ids_to_fetch)} unique assets to fetch")

    ordered_asset_ids = sorted(asset_ids_to_fetch, key=int)

    # Fetch thumbnails
    print("\nFetching thumbnails from Roblox API...")
    thumbnail_urls = fetch_thumbnails(ordered_asset_ids)

    print(f"\nSuccessfully fetched {len([u for u in thumbnail_urls.values() if u])} thumbnails")
    print(f"Failed to fetch {len([u for u in thumbnail_urls.values() if not u])} thumbnails")

    # Update cars data with thumbnail URLs
    print("\nUpdating database with thumbnail URLs...")
    for car_key, car_data in cars_data.items():
        # Add CarImageUrl
        if 'CarImage' in car_data:
            car_image_id = extract_asset_id(car_data['CarImage'])
            if car_image_id and car_image_id in thumbnail_urls:
                car_data['CarImageUrl'] = thumbnail_urls[car_image_id]
        
        # Add RimsUrl
        if 'Rims' in car_data:
            rims_id = extract_asset_id(car_data['Rims'])
            if rims_id and rims_id in thumbnail_urls:
                car_data['RimsUrl'] = thumbnail_urls[rims_id]
    
    # Save updated database
    output_path = db_path
    print(f"\nSaving updated database to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(cars_data, f, indent=2, ensure_ascii=False)
    
    print("\n✓ Done! Database updated with thumbnail URLs.")
    print(f"  Updated file: {output_path}")

if __name__ == "__main__":
    main()
