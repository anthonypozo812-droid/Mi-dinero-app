const KEY="miDineroOffline_v1";
const fmt=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n)||0);
const monthKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
const monthName=()=>new Date().toLocaleDateString("es-EC",{month:"long",year:"numeric"});
const defaultState=()=>({balance:0,unassigned:0,savings:0,budgets:[],transactions:[],month:monthKey(),closedMonths:[]});
let state=load();
// Si el usuario vuelve a abrir la app en un mes nuevo, cierra el anterior
// y mueve los sobrantes a ahorro. No depende de internet.
function rolloverIfNeeded(){
 const current=monthKey();
 if(state.month===current) return;
 if(!state.closedMonths.includes(state.month)){
   const surplus=money(state.budgets.reduce((s,b)=>s+b.remaining,0));
   state.savings=money(state.savings+surplus);
   if(surplus>0) state.transactions.unshift({id:Date.now(),type:"transfer",amount:surplus,desc:"Sobrantes del mes transferidos a ahorro",category:"Ahorro",date:new Date().toISOString()});
   state.closedMonths.push(state.month);
 }
 state.budgets=[];
 state.month=current;
 localStorage.setItem(KEY,JSON.stringify(state));
}
rolloverIfNeeded();
function load(){try{return {...defaultState(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return defaultState()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));render()}
function money(v){return Math.round((Number(v)+Number.EPSILON)*100)/100}
function toast(s){const t=document.getElementById("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
function addTx(type,amount,desc,category){const a=money(amount);state.transactions.unshift({id:Date.now(),type,amount:a,desc,category,date:new Date().toISOString()})}
function render(){
 document.getElementById("totalBalance").textContent=fmt(state.balance);
 document.getElementById("unassigned").textContent=fmt(state.unassigned);
 document.getElementById("inBudgets").textContent=fmt(state.budgets.reduce((s,b)=>s+b.remaining,0));
 document.getElementById("savings").textContent=fmt(state.savings);
 document.getElementById("savingsLarge").textContent=fmt(state.savings);
 document.getElementById("monthLabel").textContent=monthName();
 const list=document.getElementById("budgets");list.innerHTML="";
 state.budgets.forEach((b,i)=>{const spent=money(b.allocated-b.remaining),pct=b.allocated?Math.min(100,spent/b.allocated*100):0;const el=document.createElement("article");el.className="budget";el.innerHTML=`<div class="budget-top"><div><div class="budget-name">${esc(b.name)}</div><div class="budget-values">Gastado <b>${fmt(spent)}</b> de ${fmt(b.allocated)}</div></div><div class="budget-actions"><button class="mini" data-spend="${i}">＋ Gasto</button><button class="mini" data-edit="${i}">Editar</button></div></div><div class="bar"><span style="width:${pct}%"></span></div><div class="budget-foot"><span>${pct.toFixed(0)}% utilizado</span><strong>Quedan ${fmt(b.remaining)}</strong></div>`;list.appendChild(el)});
 document.getElementById("budgetEmpty").classList.toggle("hidden",state.budgets.length>0);
 const tx=document.getElementById("transactions");tx.innerHTML="";
 state.transactions.slice(0,12).forEach(t=>{const el=document.createElement("div");el.className="transaction";const sign=t.type==="income"?"+":t.type==="expense"?"−":"";el.innerHTML=`<div class="tx-icon">${t.type==="income"?"↗":t.type==="expense"?"↙":"⇄"}</div><div class="tx-main"><b>${esc(t.desc)}</b><small>${esc(t.category|| (t.type==="income"?"Ingreso":"Movimiento"))} · ${new Date(t.date).toLocaleDateString("es-EC")}</small></div><div class="tx-amount ${t.type==="income"?"positive":t.type==="expense"?"negative":""}">${sign}${fmt(t.amount)}</div>`;tx.appendChild(el)});
 document.getElementById("txEmpty").classList.toggle("hidden",state.transactions.length>0);
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const modal=document.getElementById("modal"),body=document.getElementById("modalBody"),title=document.getElementById("modalTitle");
function openModal(t,html,handler){title.textContent=t;body.innerHTML=`<div class="modal-content">${html}</div>`;modal.showModal();document.getElementById("modalForm").onsubmit=e=>{e.preventDefault();try{if(handler()!==false)modal.close()}catch(err){toast(err.message)}}}
const field=(label,name,type="text",value="",extra="")=>`<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></div>`;
function val(n){return document.querySelector(`[name="${n}"]`).value}
document.getElementById("incomeBtn").onclick=()=>openModal("Registrar ingreso",field("Descripción","desc")+field("Cantidad ($)","amount","number","","min=\"0.01\" step=\"0.01\""),()=>{const a=Number(val("amount"));if(!a||a<=0)throw Error("Ingresa una cantidad válida.");state.balance=money(state.balance+a);state.unassigned=money(state.unassigned+a);addTx("income",a,val("desc"),"Ingreso");save();toast("Ingreso agregado al dinero sin asignar.")});
document.getElementById("allocateBtn").onclick=()=>openModal("Asignar dinero",`<div class="muted">Dinero sin asignar: <b>${fmt(state.unassigned)}</b></div>${field("Nombre del presupuesto","name")}${field("Cantidad a asignar ($)","amount","number","","min=\"0.01\" step=\"0.01\"")}`,()=>{const a=Number(val("amount"));if(!a||a<=0)throw Error("Ingresa una cantidad válida.");if(a>state.unassigned)throw Error("No tienes suficiente dinero sin asignar.");state.unassigned=money(state.unassigned-a);state.budgets.push({name:val("name").trim(),allocated:a,remaining:a});addTx("transfer",a,"Presupuesto: "+val("name"),"Asignación");save();toast("Dinero asignado correctamente.")});
document.getElementById("expenseBtn").onclick=()=>{if(!state.budgets.length){toast("Primero crea un presupuesto y asígnale dinero.");return}openExpense()};
function openExpense(index){const opts=state.budgets.map((b,i)=>`<option value="${i}" ${index===i?"selected":""}>${esc(b.name)} · disponible ${fmt(b.remaining)}</option>`).join("");openModal("Registrar gasto",`${field("Descripción","desc")}${field("Cantidad ($)","amount","number","","min=\"0.01\" step=\"0.01\"")}<div class="field"><label>Categoría</label><select name="category">${opts}</select></div>`,()=>{const a=Number(val("amount")),i=Number(val("category")),b=state.budgets[i];if(!a||a<=0)throw Error("Ingresa una cantidad válida.");if(a>b.remaining)throw Error("El gasto supera el dinero disponible en esta categoría.");b.remaining=money(b.remaining-a);state.balance=money(state.balance-a);addTx("expense",a,val("desc"),b.name);save();toast("Gasto descontado de "+b.name+".")})}
document.getElementById("addCategoryBtn").onclick=()=>openModal("Crear presupuesto",field("Nombre de la categoría","name")+field("Cantidad a asignar ($)","amount","number","","min=\"0.01\" step=\"0.01\""),()=>{const a=Number(val("amount"));if(!val("name").trim()||!a||a<=0)throw Error("Completa los datos correctamente.");if(a>state.unassigned)throw Error("No tienes suficiente dinero sin asignar.");state.unassigned=money(state.unassigned-a);state.budgets.push({name:val("name").trim(),allocated:a,remaining:a});addTx("transfer",a,"Presupuesto: "+val("name"),"Asignación");save();toast("Presupuesto creado.")});
document.getElementById("budgets").addEventListener("click",e=>{const s=e.target.dataset.spend,ed=e.target.dataset.edit;if(s!==undefined)openExpense(Number(s));if(ed!==undefined){const i=Number(ed),b=state.budgets[i];openModal("Editar presupuesto",field("Nombre","name","text",b.name)+field("Nuevo límite total ($)","amount","number",b.allocated,"min=\"0.01\" step=\"0.01\""),()=>{const a=Number(val("amount")),n=val("name").trim(),delta=money(a-b.allocated);if(!a||a<=0||!n)throw Error("Datos inválidos.");if(delta>state.unassigned)throw Error("No tienes suficiente dinero sin asignar para aumentar este presupuesto.");if(delta<0)state.unassigned=money(state.unassigned-delta);else state.unassigned=money(state.unassigned-delta);b.allocated=a;b.remaining=money(b.remaining+delta);if(b.remaining<0)throw Error("El nuevo límite no puede ser menor a lo que ya gastaste.");b.name=n;save();toast("Presupuesto actualizado.")})}});
document.getElementById("closeMonthBtn").onclick=()=>{if(!state.budgets.length){toast("No hay presupuestos para cerrar.");return}if(state.closedMonths.includes(state.month)){toast("Este mes ya fue cerrado.");return}const surplus=money(state.budgets.reduce((s,b)=>s+b.remaining,0));if(!confirm(`Se pasarán ${fmt(surplus)} de sobrantes a tu ahorro. ¿Cerrar el mes?`))return;state.savings=money(state.savings+surplus);state.closedMonths.push(state.month);addTx("transfer",surplus,"Sobrantes del mes transferidos a ahorro","Ahorro");state.budgets=[];state.month=monthKey();save();toast(fmt(surplus)+" añadidos a tus ahorros.")};
document.getElementById("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mi-dinero-respaldo.json";a.click();URL.revokeObjectURL(a.href);toast("Respaldo descargado.")};
document.getElementById("importBtn").onclick=()=>document.getElementById("importFile").click();
document.getElementById("importFile").onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const d=JSON.parse(await f.text());if(typeof d.balance!=="number"||!Array.isArray(d.budgets)||!Array.isArray(d.transactions))throw Error();state={...defaultState(),...d};save();toast("Respaldo restaurado.")}catch{toast("El archivo no es un respaldo válido.")}e.target.value=""};
document.getElementById("resetBtn").onclick=()=>{if(confirm("¿Seguro que quieres borrar todos tus datos? Esta acción no se puede deshacer.")){state=defaultState();save();toast("Datos borrados.")}};
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
render();