
(async()=>{
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const F=window.DashFilters, V=window.DashCharts;
 const [growth,promotion,workforce,assortment,delivery]=await Promise.all([
  fetch("outputs/growth_data.json").then(r=>r.json()),
  fetch("outputs/promotion_data.json").then(r=>r.json()),
  fetch("outputs/workforce_data.json").then(r=>r.json()),
  fetch("outputs/assortment_data.json").then(r=>r.json()),
  fetch("outputs/delivery_return_data.json").then(r=>r.json())
 ]);
 const data={growth,promotion,workforce:workforce.rows,assortment:assortment.products,delivery:delivery.overall};
 const sum=(a,k)=>a.reduce((s,r)=>s+(+r[k]||0),0);
 const group=(rows,key,metrics)=>{
   const m=new Map(); rows.forEach(r=>{const k=r[key];if(!m.has(k))m.set(k,{key:k});const o=m.get(k);metrics.forEach(x=>o[x]=(o[x]||0)+(+r[x]||0));});
   return [...m.values()];
 };
 const card=(label,value,sub="")=>`<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
 const insight=(finding,decision,limit)=>`<div class="insight-grid"><div><strong>Key finding</strong><p>${finding}</p></div><div><strong>Decision implication</strong><p>${decision}</p></div><div><strong>Limitation</strong><p>${limit}</p></div></div>`;
 const opts=()=>JSON.parse(JSON.stringify(V.baseOpts));
 function annual(rows){const a=group(rows,"year",["revenue","orders"]);a.forEach(x=>x.aov=x.orders?x.revenue/x.orders:0);return a.sort((a,b)=>a.key-b.key)}
 function renderGrowth(){
  const rows=F.apply("growth",growth), rev=sum(rows,"revenue"), ord=sum(rows,"orders"), aov=ord?rev/ord:0;
  $("#growth-kpis").innerHTML=card("Payment Revenue",V.money(rev),"Order grain")+card("Distinct Orders",V.num(ord),"2020–2023 complete years")+card("AOV",V.num(aov),"Revenue / distinct orders");
  const a=annual(rows), b=a.find(x=>x.key===2020)||a[0], labels=a.map(x=>x.key);
  V.make("growth-index",{type:"line",data:{labels,datasets:[
   {label:"Revenue Index",data:a.map(x=>b?100*x.revenue/b.revenue:0),borderColor:V.C.navy,backgroundColor:V.C.navy},
   {label:"Orders Index",data:a.map(x=>b?100*x.orders/b.orders:0),borderColor:V.C.teal,backgroundColor:V.C.teal},
   {label:"AOV Index",data:a.map(x=>b?100*x.aov/b.aov:0),borderColor:V.C.orange,backgroundColor:V.C.orange}
  ]},options:{...opts(),scales:{x:{grid:{display:false}},y:{title:{display:true,text:"Index (base = 100)"}}}}});
  V.make("growth-decomp",{type:"bar",data:{labels,datasets:[{label:"Revenue",data:a.map(x=>x.revenue),backgroundColor:V.C.navy}]},options:opts()});
  const m=group(rows,"month",["revenue","orders"]).sort((a,b)=>a.key-b.key);m.forEach(x=>{x.aov=x.orders?x.revenue/x.orders:0;x.opd=x.orders/[31,29,31,30,31,30,31,31,30,31,30,31][x.key-1]});
  V.make("growth-monthly",{type:"line",data:{labels:m.map(x=>new Date(2020,x.key-1,1).toLocaleString("en",{month:"short"})),datasets:[
   {label:"Orders/day",data:m.map(x=>x.opd),borderColor:V.C.teal,backgroundColor:V.C.teal,yAxisID:"y"},
   {label:"AOV",data:m.map(x=>x.aov),borderColor:V.C.orange,backgroundColor:V.C.orange,yAxisID:"y1"}
  ]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:false},y1:{position:"right",beginAtZero:false,grid:{drawOnChartArea:false}}}}});
  $("#growth-insight").innerHTML=insight("Revenue, orders and AOV remain tightly bounded across the four complete years.","Set growth targets around incremental order generation while retaining AOV as a guardrail.","The extract does not establish causal drivers of customer acquisition or repeat purchasing.");
 }
 function renderPromotion(){
  const rows=F.apply("promotion",promotion), rev=sum(rows,"revenue"), ord=sum(rows,"orders"), ret=sum(rows,"returned_orders");
  const promos=new Set(rows.map(r=>r.promotion_id)).size;
  $("#promotion-kpis").innerHTML=card("Orders",V.num(ord),"Distinct order grain")+card("Overall AOV",V.num(ord?rev/ord:0),"Payment revenue / orders")+card("Revenue / Promotion",V.money(promos?rev/promos:0),"Coverage-normalized")+card("Returned-order Rate",V.pct(ord?ret/ord:0),`${V.num(ret)} / ${V.num(ord)} orders`);
  const b=group(rows,"discount_band",["revenue","orders","returned_orders"]);b.forEach(x=>{x.aov=x.orders?x.revenue/x.orders:0;x.rr=x.orders?x.returned_orders/x.orders:0});
  V.make("promo-aov",{type:"bar",data:{labels:b.map(x=>x.key),datasets:[{label:"AOV",data:b.map(x=>x.aov),backgroundColor:V.C.navy}]},options:opts()});
  const rb=b.map(x=>{const n=new Set(rows.filter(r=>r.discount_band===x.key).map(r=>r.promotion_id)).size;return n?x.revenue/n:0});
  V.make("promo-rpp",{type:"bar",data:{labels:b.map(x=>x.key),datasets:[{label:"Revenue / promotion",data:rb,backgroundColor:V.C.teal}]},options:opts()});
  const pp=group(rows,"promotion_id",["revenue","orders"]);pp.forEach(x=>x.discount=+(rows.find(r=>r.promotion_id===x.key)?.discount||0));
  V.make("promo-scatter",{type:"scatter",data:{datasets:[{label:"Promotion",data:pp.map(x=>({x:x.discount,y:x.revenue,id:x.key})),backgroundColor:V.C.orange}]},options:{...opts(),plugins:{tooltip:{callbacks:{label:c=>`Promo ${c.raw.id}: ${c.raw.x}% · ${V.money(c.raw.y)}`}}}}});
  V.make("promo-return",{type:"bar",data:{labels:b.map(x=>x.key),datasets:[{label:"Returned-order rate",data:b.map(x=>100*x.rr),backgroundColor:V.C.orange}]},options:{...opts(),scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:"%"}}}}});
  $("#promo-table").innerHTML="<thead><tr><th>Promotion</th><th>Discount</th><th>Orders</th><th>Revenue</th><th>AOV</th><th>Return rate</th></tr></thead><tbody>"+pp.sort((a,b)=>b.revenue-a.revenue).map(x=>{const rr=rows.filter(r=>r.promotion_id===x.key);const o=sum(rr,"orders"),rv=sum(rr,"revenue"),rt=sum(rr,"returned_orders");return `<tr><td>Promo ${x.key}</td><td>${x.discount}%</td><td>${V.num(o)}</td><td>${V.money(rv)}</td><td>${V.num(o?rv/o:0)}</td><td>${V.pct(o?rt/o:0)}</td></tr>`}).join("")+"</tbody>";
  $("#promotion-insight").innerHTML=insight("Observed AOV and returned-order rates change little across discount-depth bands.","Move deeper offers into controlled treatment-control tests before scaling them.","Promotion assignment has no untreated control group; these visuals are observational, not causal.");
 }
 function renderWorkforce(){
  const rows=F.apply("workforce",workforce.rows), rev=sum(rows,"revenue"), ord=sum(rows,"orders"), hc=sum(rows,"headcount");
  $("#workforce-kpis").innerHTML=card("2023 Payment Revenue",V.money(rev),"2023 only")+card("2023 Orders",V.num(ord),"Distinct orders")+card("Current Headcount",V.num(hc),"Current assignment")+card("Revenue Elasticity",(workforce.revenue_elasticity??0).toFixed(3),"Log-log store comparison");
  V.make("work-scatter",{type:"scatter",data:{datasets:[{label:"Store",data:rows.map(r=>({x:r.headcount,y:r.revenue,store:r.store_id,city:r.city,rpe:r.revenue_per_employee})),backgroundColor:V.C.navy}]},options:{...opts(),plugins:{tooltip:{callbacks:{label:c=>`Store ${c.raw.store} · ${c.raw.city}: staff ${c.raw.x}, revenue ${V.money(c.raw.y)}, rev/emp ${V.money(c.raw.rpe)}`}}}}});
  const b=group(rows,"staffing_band",["revenue","orders","headcount"]);b.forEach(x=>{x.rpe=x.headcount?x.revenue/x.headcount:0;x.ope=x.headcount?x.orders/x.headcount:0});
  V.make("work-rpe",{type:"bar",data:{labels:b.map(x=>x.key),datasets:[{label:"Revenue / employee",data:b.map(x=>x.rpe),backgroundColor:V.C.teal}]},options:opts()});
  V.make("work-ope",{type:"bar",data:{labels:b.map(x=>x.key),datasets:[{label:"Orders / employee",data:b.map(x=>x.ope),backgroundColor:V.C.orange}]},options:opts()});
  const ext=[...rows].sort((a,b)=>b.revenue_per_employee-a.revenue_per_employee);
  const pick=[...ext.slice(0,5),...ext.slice(-5).reverse()];
  $("#work-table").innerHTML="<thead><tr><th>Store</th><th>City</th><th>Staff</th><th>Revenue</th><th>Rev/Employee</th><th>Orders/Employee</th></tr></thead><tbody>"+pick.map(r=>`<tr><td>Store ${r.store_id}</td><td>${r.city}</td><td>${r.headcount}</td><td>${V.money(r.revenue)}</td><td>${V.money(r.revenue_per_employee)}</td><td>${V.num(r.orders_per_employee)}</td></tr>`).join("")+"</tbody>";
  $("#workforce-insight").innerHTML=insight("Current headcount varies much more than 2023 store output, so per-employee ratios fall across larger staffing bands.","Prioritize operating audits at high-headcount, low-productivity stores before making staffing changes.","This is 2023 output versus current headcount. Employee effective dates, labor hours, traffic and floor area are unavailable.");
 }
 function assortmentFiltered(){
   return F.apply("assortment",assortment.products);
 }
 function catsFromProducts(rows){
  const m=new Map();rows.forEach(r=>{const k=r.category_name;if(!m.has(k))m.set(k,{category_name:k,gmv:0,sku:new Set(),units:0,item_lines:0,returned_lines:0});const x=m.get(k);x.gmv+=+r.gmv;x.sku.add(r.product_id);x.units+=+r.units;x.item_lines+=+r.item_lines;x.returned_lines+=+r.returned_lines});
  const out=[...m.values()].map(x=>({...x,sku_count:x.sku.size,gmv_per_sku:x.sku.size?x.gmv/x.sku.size:0,return_line_rate:x.item_lines?x.returned_lines/x.item_lines:0}));
  if(out.length>1){const n=out.length,sx=sum(out,"sku_count"),sy=sum(out,"gmv"),sxx=out.reduce((s,x)=>s+x.sku_count*x.sku_count,0),sxy=out.reduce((s,x)=>s+x.sku_count*x.gmv,0);const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1),inter=(sy-slope*sx)/n;out.forEach(x=>{x.expected=inter+slope*x.sku_count;x.residual=x.gmv-x.expected});}
  else out.forEach(x=>{x.expected=x.gmv;x.residual=0});
  [...out].sort((a,b)=>b.gmv-a.gmv).forEach((x,i)=>x.gmv_rank=i+1);[...out].sort((a,b)=>b.gmv_per_sku-a.gmv_per_sku).forEach((x,i)=>x.prod_rank=i+1);return out;
 }
 function renderAssortment(){
  const rows=assortmentFiltered(), cats=catsFromProducts(rows), gmv=sum(rows,"gmv"), skus=new Set(rows.map(r=>r.product_id)).size;
  const r=cats.length>1?corr(cats.map(x=>x.sku_count),cats.map(x=>x.gmv)):0;
  $("#assortment-kpis").innerHTML=card("Item GMV",V.money(gmv),"Item grain")+card("SKU Count",V.num(skus),"Product master in filter")+card("Pearson r",r.toFixed(3),"SKU count vs category GMV")+card("Explained Variation",(100*r*r).toFixed(1)+"%","R² from simple relationship");
  V.make("assort-scatter",{type:"scatter",data:{datasets:[{label:"Category",data:cats.map(x=>({x:x.sku_count,y:x.gmv,name:x.category_name})),backgroundColor:V.C.navy}]},options:{...opts(),plugins:{tooltip:{callbacks:{label:c=>`${c.raw.name}: ${c.raw.x} SKUs · GMV ${V.money(c.raw.y)}`}}}}});
  const top=[...cats].sort((a,b)=>b.gmv_per_sku-a.gmv_per_sku).slice(0,12);
  V.make("assort-gps",{type:"bar",data:{labels:top.map(x=>x.category_name),datasets:[{label:"GMV / SKU",data:top.map(x=>x.gmv_per_sku),backgroundColor:V.C.teal}]},options:opts()});
  const res=[...cats].sort((a,b)=>b.residual-a.residual);
  V.make("assort-resid",{type:"bar",data:{labels:res.map(x=>x.category_name),datasets:[{label:"Residual GMV",data:res.map(x=>x.residual),backgroundColor:res.map(x=>x.residual>=0?V.C.teal:V.C.orange)}]},options:opts()});
  V.make("assort-rank",{type:"scatter",data:{datasets:[{label:"Category rank",data:cats.map(x=>({x:x.gmv_rank,y:x.prod_rank,name:x.category_name})),backgroundColor:V.C.orange}]},options:{...opts(),scales:{x:{title:{display:true,text:"Total GMV rank"},reverse:false},y:{title:{display:true,text:"GMV/SKU rank"},reverse:false}},plugins:{tooltip:{callbacks:{label:c=>`${c.raw.name}: GMV #${c.raw.x}, productivity #${c.raw.y}`}}}}});
  $("#assort-table").innerHTML="<thead><tr><th>Product</th><th>Category</th><th>Supplier</th><th>Country</th><th>GMV</th><th>Units</th><th>Return-line rate</th></tr></thead><tbody>"+[...rows].sort((a,b)=>b.gmv-a.gmv).slice(0,100).map(x=>`<tr><td>Product ${x.product_id}</td><td>${x.category_name}</td><td>${x.supplier_id}</td><td>${x.country}</td><td>${V.money(x.gmv)}</td><td>${V.num(x.units)}</td><td>${V.pct(x.return_line_rate)}</td></tr>`).join("")+"</tbody>";
  $("#assortment-insight").innerHTML=insight("Total category GMV is strongly related to assortment breadth; total-GMV leadership is not the same as per-SKU productivity leadership.","Use GMV/SKU and breadth-adjusted residuals to prioritize SKU-level review before expanding or removing assortment.","Item GMV is an item-level measure and is intentionally kept separate from order-level payment revenue.");
 }
 function corr(x,y){const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;let a=0,b=0,c=0;for(let i=0;i<n;i++){const dx=x[i]-mx,dy=y[i]-my;a+=dx*dy;b+=dx*dx;c+=dy*dy}return b&&c?a/Math.sqrt(b*c):0}
 function renderDelivery(){
  let base=delivery.overall, category=F.state.delivery?.category_name;
  let rows;
  if(category){
    rows=F.apply("delivery",delivery.by_category);
  }else{
    rows=F.apply("delivery",base);
  }
  const ord=sum(rows,"orders"), ret=sum(rows,"returned_orders");
  const lateRows=rows.filter(r=>String(r.status).toLowerCase()==="late"), lateO=sum(lateRows,"orders"),lateR=sum(lateRows,"returned_orders");
  const non=rows.filter(r=>String(r.status).toLowerCase()!=="late"), nonO=sum(non,"orders"),nonR=sum(non,"returned_orders");
  const lr=lateO?lateR/lateO:0,nr=nonO?nonR/nonO:0, risk=nr?lr/nr:0;
  $("#delivery-kpis").innerHTML=card("Late Status Rate",V.pct(ord?lateO/ord:0),`${V.num(lateO)} / ${V.num(ord)} orders`)+card("Late Return Rate",V.pct(lr),`${V.num(lateR)} / ${V.num(lateO)} late orders`)+card("Non-late Return Rate",V.pct(nr),`${V.num(nonR)} / ${V.num(nonO)} non-late orders`)+card("Risk Ratio",risk.toFixed(3),"Late rate / non-late rate");
  const s=group(rows,"status",["orders","returned_orders"]);s.forEach(x=>x.rr=x.orders?x.returned_orders/x.orders:0);
  V.make("delivery-status",{type:"bar",data:{labels:s.map(x=>x.key),datasets:[{label:"Returned-order rate (%)",data:s.map(x=>100*x.rr),backgroundColor:V.C.navy}]},options:opts()});
  V.make("delivery-late",{type:"bar",data:{labels:["Late","Non-late"],datasets:[{label:"Returned-order rate (%)",data:[100*lr,100*nr],backgroundColor:[V.C.orange,V.C.teal]}]},options:opts()});
  const bb=group(rows,"basket_band",["orders","returned_orders"]);bb.forEach(x=>x.rr=x.orders?x.returned_orders/x.orders:0);
  V.make("delivery-basket",{type:"bar",data:{labels:bb.map(x=>x.key),datasets:[{label:"Return rate (%)",data:bb.map(x=>100*x.rr),backgroundColor:V.C.teal}]},options:opts()});
  const st=group(rows.filter(r=>String(r.status).toLowerCase()==="late"),"store_id",["orders"]);const total=group(rows,"store_id",["orders"]);const tm=new Map(total.map(x=>[x.key,x.orders]));st.forEach(x=>x.rate=(tm.get(x.key)||0)?x.orders/tm.get(x.key):0);st.sort((a,b)=>b.rate-a.rate);
  V.make("delivery-store",{type:"bar",data:{labels:st.slice(0,12).map(x=>"Store "+x.key),datasets:[{label:"Late rate (%)",data:st.slice(0,12).map(x=>100*x.rate),backgroundColor:V.C.orange}]},options:opts()});
  $("#delivery-insight").innerHTML=insight("Returned-order likelihood is very similar between the recorded late and non-late groups.","Broaden return-cause investigation beyond shipment status and improve reason/timeline capture before redirecting return-reduction investment.","Shipment status is a snapshot; promised, shipped, delivered and return-request timestamps are unavailable.");
 }
 const renderers={growth:renderGrowth,promotion:renderPromotion,workforce:renderWorkforce,assortment:renderAssortment,delivery:renderDelivery};
 window.Dashboard={render:p=>renderers[p]()};
 F.build("growth",growth);F.build("promotion",promotion);F.build("workforce",workforce.rows);F.build("assortment",assortment.products);
 const deliveryFilterRows=delivery.by_category;F.build("delivery",deliveryFilterRows);
 $$(".nav-btn").forEach(b=>b.addEventListener("click",()=>{$$(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".page").forEach(x=>x.classList.remove("active"));$("#"+b.dataset.page).classList.add("active");renderers[b.dataset.page]();}));
 $$("[data-reset]").forEach(b=>b.addEventListener("click",()=>{F.reset(b.dataset.reset);renderers[b.dataset.reset]()}));
 Object.values(renderers).forEach(fn=>fn());
})().catch(err=>{console.error(err);document.querySelector(".main").insertAdjacentHTML("afterbegin",`<div style="padding:12px;background:#fee2e2;color:#991b1b;border-radius:8px;margin-bottom:12px">Dashboard data failed to load. Run <b>python process_data.py</b> and serve the folder through a local HTTP server. ${err.message}</div>`)});
