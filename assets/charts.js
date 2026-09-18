
window.DashCharts=(()=>{
 const C={navy:"#1d3557",teal:"#1f8a8a",orange:"#d9822b",red:"#c84b4b",gray:"#94a3b8"};
 const charts={};
 function make(id,config){if(charts[id]) charts[id].destroy(); const el=document.getElementById(id); if(!el)return; charts[id]=new Chart(el,config);}
 const money=v=>new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:2}).format(v||0);
 const num=v=>new Intl.NumberFormat("en",{maximumFractionDigits:1}).format(v||0);
 const pct=v=>`${((v||0)*100).toFixed(2)}%`;
 const baseOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{boxWidth:10,usePointStyle:true}},tooltip:{mode:"nearest",intersect:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true}}};
 return {make,C,money,num,pct,baseOpts,charts};
})();
