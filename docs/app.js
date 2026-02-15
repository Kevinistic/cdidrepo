const results = document.getElementById("results");
const searchBox = document.getElementById("search");
const limitedFilter = document.getElementById("limitedFilter");
const sortBy = document.getElementById("sortBy");
const pagination = document.getElementById("pagination");
const pageInfo = document.getElementById("pageInfo");

let cars = [];
let filtered = [];
let currentPage = 1;
const CARS_PER_PAGE = 50;

fetch("database/cars_combined.json")
.then(r=>r.json())
.then(data=>{
    cars = Object.entries(data).map(([key,val])=>{

    const displayName = val.CarName || key;

    return {
        // id: key,
        name: displayName,
        ...val,
        search:displayName.toLowerCase()
    };
    });

    filtered = cars;
    applySort();
    render();
});

function filter(){
    const term = searchBox.value.toLowerCase();
    const limitedOption = limitedFilter.value;

    filtered = cars.filter(c=>{
        // Filter by limited status
        const isLimited = "Unobtainable" in c;
        if(limitedOption === "show-limiteds" && !isLimited) return false;
        if(limitedOption === "hide-limiteds" && isLimited) return false;
        
        // Filter by search term
        return c.search.includes(term);
    });

    currentPage = 1; // Reset to first page on filter
    applySort();
    render();
}

function applySort(){
    const sort = sortBy.value;
    
    if(sort === "none") return;
    
    filtered.sort((a, b) => {
        if(sort === "name-asc"){
            return a.name.localeCompare(b.name);
        }
        if(sort === "name-desc"){
            return b.name.localeCompare(a.name);
        }
        if(sort === "price-asc"){
            return (a.Cost || 0) - (b.Cost || 0);
        }
        if(sort === "price-desc"){
            return (b.Cost || 0) - (a.Cost || 0);
        }
        return 0;
    });
}

searchBox.addEventListener("input",filter);
limitedFilter.addEventListener("change",filter);
sortBy.addEventListener("change",filter);

function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

function render(){
    results.innerHTML="";

    const totalPages = Math.ceil(filtered.length / CARS_PER_PAGE);
    const startIdx = (currentPage - 1) * CARS_PER_PAGE;
    const endIdx = Math.min(startIdx + CARS_PER_PAGE, filtered.length);
    const pageCars = filtered.slice(startIdx, endIdx);

    // Render cars for current page
    for(let i=0; i<pageCars.length; i++){
        const car = pageCars[i];

        const div=document.createElement("div");
        div.className="car";

        const content = document.createElement("div");
        content.className = "car-content";

        const textContent = document.createElement("div");
        textContent.className = "car-text";

        // Create image container
        const imageContainer = document.createElement("div");
        imageContainer.className = "car-images";
        
        // Car image
        if (car.CarImageUrl) {
            const carImageWrapper = document.createElement("div");
            carImageWrapper.className = "image-wrapper";
            const carImg = document.createElement("img");
            carImg.className = "car-thumbnail";
            carImg.alt = "Car";
            carImg.loading = "lazy";
            carImg.src = car.CarImageUrl;
            carImg.onerror = function() {
                this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%23222' width='150' height='150'/%3E%3Ctext fill='%23888' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='sans-serif' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
            };
            const carLabel = document.createElement("div");
            carLabel.className = "image-label";
            carLabel.textContent = "Car";
            carImageWrapper.appendChild(carImg);
            carImageWrapper.appendChild(carLabel);
            imageContainer.appendChild(carImageWrapper);
        }
        
        // Rims image
        if (car.RimsUrl) {
            const rimsWrapper = document.createElement("div");
            rimsWrapper.className = "image-wrapper";
            const rimsImg = document.createElement("img");
            rimsImg.className = "car-thumbnail";
            rimsImg.alt = "Rims";
            rimsImg.loading = "lazy";
            rimsImg.src = car.RimsUrl;
            rimsImg.onerror = function() {
                this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect fill='%23222' width='150' height='150'/%3E%3Ctext fill='%23888' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='sans-serif' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
            };
            const rimsLabel = document.createElement("div");
            rimsLabel.className = "image-label";
            rimsLabel.textContent = "Rims";
            rimsWrapper.appendChild(rimsImg);
            rimsWrapper.appendChild(rimsLabel);
            imageContainer.appendChild(rimsWrapper);
        }
        
        const title=document.createElement("b");
        title.textContent=car.name;
        textContent.appendChild(title);

        for(const key in car){
            if(key==="name"||key==="search"||key==="CarName"||key==="CarImage"||key==="CarImageUrl"||key==="RimsUrl"||key==="Unobtainable")continue;

            const p=document.createElement("div");

            if(key==="Cost"){
                // separate digit groups with dots
                const costStr = car[key].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                p.textContent = "Price: Rp. " + costStr;
                textContent.appendChild(p);
                continue;
            }
            
            // Special handling for Color attribute
            if(key === "Color" && car[key] && car[key].rgb && Array.isArray(car[key].rgb) && car[key].rgb.length === 3){
                const [r, g, b] = car[key].rgb;
                const hex = rgbToHex(Math.round(r), Math.round(g), Math.round(b));
                p.innerHTML = `Color: ${hex} <span style="display:inline-block;width:15px;height:15px;background:${hex};border:1px solid #666;vertical-align:middle;margin-left:5px;border-radius:3px;"></span>`;
            } else {
                p.textContent = key + ": " + JSON.stringify(car[key]);
            }
            
            textContent.appendChild(p);

            // handling for rims code, replace link with pure code
            if(key === "Rims"){
                const rimsStr = car[key].toString().split("/").pop(); // get last part of the URL
                const equalsIndex = rimsStr.indexOf("=");
                if(equalsIndex !== -1) {
                    const afterEquals = rimsStr.substring(equalsIndex + 1);
                    if(afterEquals.length > 0) {
                        p.textContent = "Rims Code: " + afterEquals;
                    }
                } else {
                    p.textContent = "Rims Code: " + rimsStr;
                }
                textContent.appendChild(p);
            }
        }
        
        // Display Limited status
        const limitedP = document.createElement("div");
        const limitedStatus = "Unobtainable" in car ? "Limited" : "No";
        limitedP.textContent = "Limited: " + limitedStatus;
        textContent.appendChild(limitedP);

        content.appendChild(textContent);

        if (imageContainer.children.length > 0) {
            content.appendChild(imageContainer);
        }

        div.appendChild(content);

        results.appendChild(div);
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    pagination.innerHTML = "";
    
    if (totalPages <= 1) {
        pageInfo.textContent = `Showing ${filtered.length} cars`;
        return;
    }

    const startIdx = (currentPage - 1) * CARS_PER_PAGE + 1;
    const endIdx = Math.min(currentPage * CARS_PER_PAGE, filtered.length);
    pageInfo.textContent = `Showing ${startIdx}-${endIdx} of ${filtered.length} cars`;

    // Previous button
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "← Prev";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        currentPage--;
        render();
        window.scrollTo(0, 0);
    };
    pagination.appendChild(prevBtn);

    // Page numbers
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement("button");
        firstBtn.textContent = "1";
        firstBtn.onclick = () => {
            currentPage = 1;
            render();
            window.scrollTo(0, 0);
        };
        pagination.appendChild(firstBtn);
        
        if (startPage > 2) {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.className = "ellipsis";
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = i === currentPage ? "active" : "";
        btn.onclick = () => {
            currentPage = i;
            render();
            window.scrollTo(0, 0);
        };
        pagination.appendChild(btn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "...";
            ellipsis.className = "ellipsis";
            pagination.appendChild(ellipsis);
        }
        
        const lastBtn = document.createElement("button");
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => {
            currentPage = totalPages;
            render();
            window.scrollTo(0, 0);
        };
        pagination.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next →";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        currentPage++;
        render();
        window.scrollTo(0, 0);
    };
    pagination.appendChild(nextBtn);

    
}
