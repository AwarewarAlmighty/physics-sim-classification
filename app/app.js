let allData = [];
let activeCategory = "All";
let activeType = "All";
let query = "";

const rowsEl = document.getElementById("rows");
const countEl = document.getElementById("count");
const searchInput = document.getElementById("searchInput");

function norm(s){ return String(s || "").toLowerCase(); }

function matches(item){
  const catOk = (activeCategory === "All") || item.category === activeCategory;
  const typeOk = (activeType === "All") || item.type === activeType;

  if(!catOk || !typeOk) return false;

  if(!query) return true;

  const hay = [
    item.category,
    item.type,
    item.example,
    (item.keyVariables || []).join(" "),
    item.sharedPattern,
    item.equation,
    item.notes
  ].map(norm).join(" | ");

  return hay.includes(query);
}

function pillList(vars){
  return (vars || []).map(v => `<span class="pill">${v}</span>`).join("");
}

function render(){
  const filtered = allData.filter(matches);

  rowsEl.innerHTML = filtered.map(item => `
    <tr>
      <td><strong>${item.category}</strong></td>
      <td>${item.type}</td>
      <td>
        <div><strong>${item.example}</strong></div>
        ${item.notes ? `<small>${item.notes}</small>` : ""}
      </td>
      <td><div class="kvars">${pillList(item.keyVariables)}</div></td>
      <td>${item.sharedPattern}</td>
      <td><code>${item.equation}</code></td>
    </tr>
  `).join("");

  countEl.textContent = `Showing ${filtered.length} / ${allData.length} simulations`;
}

function setCategory(cat){
  activeCategory = cat;
  document.querySelectorAll(".chip[data-category]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.category === cat);
  });
  render();
}

function setType(t){
  activeType = t;
  document.querySelectorAll(".chip[data-type]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.type === t);
  });
  render();
}

async function init(){
  try{
    const res = await fetch("../data/simulations.json", { cache: "no-store" });
    allData = await res.json();

    // default active button state
    setCategory("All");
    setType("All");

    // search
    searchInput.addEventListener("input", (e)=>{
      query = norm(e.target.value).trim();
      render();
    });

    // chips
    document.querySelectorAll(".chip[data-category]").forEach(btn=>{
      btn.addEventListener("click", ()=> setCategory(btn.dataset.category));
    });
    document.querySelectorAll(".chip[data-type]").forEach(btn=>{
      btn.addEventListener("click", ()=> setType(btn.dataset.type));
    });

    render();
  }catch(err){
    rowsEl.innerHTML = `<tr><td colspan="6">Failed to load data: ${err}</td></tr>`;
    countEl.textContent = "Error loading simulations.json";
  }
}

init();
