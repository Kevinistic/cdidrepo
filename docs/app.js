const results = document.getElementById("results");
const searchBox = document.getElementById("search");
const hideUnob = document.getElementById("hideUnob");

let cars = [];
let filtered = [];

fetch("database/cars_combined.json")
.then(r=>r.json())
.then(data=>{
    cars = Object.entries(data).map(([key,val])=>{

    const displayName = val.CarName || key;

    return {
        // id: key,
        name: displayName,
        ...val,
        search:(displayName+" "+JSON.stringify(val)).toLowerCase()
    };
    });

    filtered = cars;
    render();
});

function filter(){
    const term = searchBox.value.toLowerCase();
    const hide = hideUnob.checked;

    filtered = cars.filter(c=>{
        if(hide && c.Unobtainable) return false;
        return c.search.includes(term);
    });

    render();
}

searchBox.addEventListener("input",filter);
hideUnob.addEventListener("change",filter);

function render(){
    results.innerHTML="";

    const max = Math.min(filtered.length,200); // virtualization cap

    for(let i=0;i<max;i++){
        const car = filtered[i];

        const div=document.createElement("div");
        div.className="car";

        const title=document.createElement("b");
        title.textContent=car.name;
        div.appendChild(title);

        for(const key in car){
            if(key==="name"||key==="search")continue;

            const p=document.createElement("div");
            p.textContent=key+": "+JSON.stringify(car[key]);
            div.appendChild(p);
        }

        results.appendChild(div);
    }
}
