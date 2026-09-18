
window.DashFilters = (() => {
 const specs={
  growth:[["year","Year"],["city","City"],["store_id","Store"]],
  promotion:[["year","Year"],["city","City"],["store_id","Store"],["discount_band","Discount Band"],["promotion_id","Promotion"]],
  workforce:[["city","City"],["store_id","Store"],["staffing_band","Staffing Band"]],
  assortment:[["category_name","Category"],["supplier_id","Supplier"],["country","Supplier Country"],["product_id","Product"]],
  delivery:[["year","Year"],["city","City"],["store_id","Store"],["status","Shipment Status"],["category_name","Category"],["basket_band","Basket Line Band"]]
 };
 const state={};
 const label=v=>String(v).replace(/^(\d+)$/,"$1");
 function unique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}
 function build(page, rows){
   state[page]={};
   const root=document.getElementById(page+"-filters"); root.innerHTML="";
   specs[page].forEach(([key,title])=>{
     const wrap=document.createElement("div");wrap.className="filter";
     const lab=document.createElement("label");lab.textContent=title;
     const sel=document.createElement("select");sel.dataset.key=key;
     sel.innerHTML='<option value="">All</option>'+unique(rows,key).map(v=>`<option value="${String(v).replace(/"/g,"&quot;")}">${label(v)}</option>`).join("");
     sel.addEventListener("change",()=>{state[page][key]=sel.value; window.Dashboard.render(page);});
     wrap.append(lab,sel);root.appendChild(wrap);
   });
 }
 function apply(page,rows){const s=state[page]||{};return rows.filter(r=>Object.entries(s).every(([k,v])=>!v||String(r[k])===String(v)));}
 function reset(page){state[page]={};document.querySelectorAll(`#${page}-filters select`).forEach(s=>s.value="");}
 return {build,apply,reset,state};
})();
