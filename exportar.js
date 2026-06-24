import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDsc59q9cnB9oXxBA7M4hjlknnXH4z3MRg",
  authDomain: "construcion-4754c.firebaseapp.com",
  projectId: "construcion-4754c",
  storageBucket: "construcion-4754c.firebasestorage.app",
  messagingSenderId: "1087205398803",
  appId: "1:1087205398803:web:8cd3f8d607817cf658a2e6"
};

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const ADMIN = "Adminventas@gmail.com";

window.exportarExcel = async function() {
  const user = auth.currentUser;
  if (!user || user.email.toLowerCase() !== ADMIN.toLowerCase()) {
    alert("⛔ Solo el administrador puede exportar."); return;
  }

  const desde = document.getElementById("informeDesde")?.value;
  const hasta  = document.getElementById("informeHasta")?.value;
  if (!desde || !hasta) { alert("⚠️ Seleccione el rango de fechas en la sección Informes"); return; }

  if (!window.ExcelJS) {
    await new Promise((res,rej) => {
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js";
      s.onload=res; s.onerror=()=>rej(new Error("No se pudo cargar ExcelJS"));
      document.head.appendChild(s);
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Materiales de Construcción";
  wb.created = new Date();

  const fmt = n => Number(n||0);
  const fmtStr = n => "$" + Number(n||0).toLocaleString("es-CO");

  // Leer datos del período
  const snapV = await getDocs(query(collection(db,"Ventas"),  orderBy("fecha","asc")));
  const snapC = await getDocs(query(collection(db,"Compras"), orderBy("fecha","asc")));
  const snapG = await getDocs(query(collection(db,"Gastos"),  orderBy("fecha","asc")));
  const snapP = await getDocs(query(collection(db,"Productos"),orderBy("nombre")));
  const snapCC= await getDocs(query(collection(db,"CuentasCobrar"), orderBy("fecha","desc")));

  const ventas  = snapV.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.fecha>=desde&&v.fecha<=hasta);
  const compras = snapC.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.fecha>=desde&&c.fecha<=hasta);
  const gastos  = snapG.docs.map(d=>({id:d.id,...d.data()})).filter(g=>g.fecha>=desde&&g.fecha<=hasta);
  const productos= snapP.docs.map(d=>({id:d.id,...d.data()}));
  const cobros  = snapCC.docs.map(d=>({id:d.id,...d.data()}));

  const totVentas  = ventas.reduce((s,v)=>s+(v.total||0),0);
  const totCompras = compras.reduce((s,c)=>s+(c.costoTotal||0),0);
  const totGastos  = gastos.reduce((s,g)=>s+(g.monto||0),0);
  const ganancia   = totVentas - totCompras - totGastos;

  // ===== HOJA 1: RESUMEN EJECUTIVO =====
  const wsR = wb.addWorksheet("Resumen Ejecutivo");
  wsR.columns = [{width:35},{width:22}];
  addTitulo(wsR, `RESUMEN FINANCIERO · ${desde} al ${hasta}`, "FF0f1923");
  wsR.addRow([]);
  addFilaResumen(wsR, "Total Ingresos por Ventas",     totVentas,  "FF27ae60");
  addFilaResumen(wsR, "Total Compras (Inversión)",      totCompras, "FF2980b9");
  addFilaResumen(wsR, "Total Gastos Varios",            totGastos,  "FFc0392b");
  wsR.addRow([]);
  addFilaResumen(wsR, "GANANCIA NETA",                  ganancia,   ganancia>=0?"FF27ae60":"FFc0392b");
  wsR.addRow([]);
  addFilaResumen(wsR, "Capital en Stock (costo)",
    productos.reduce((s,p)=>s+((p.stock||0)*(p.costoUnitario||0)),0), "FFe67e22");
  wsR.addRow([]);
  addFilaInfo(wsR, "Total de ventas en período",  ventas.length);
  addFilaInfo(wsR, "Total de compras en período", compras.length);
  addFilaInfo(wsR, "Total de gastos en período",  gastos.length);

  // ===== HOJA 2: VENTAS =====
  const wsV = wb.addWorksheet("Ventas");
  wsV.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:11},
    {header:"Producto",key:"prod",width:22},{header:"Cliente",key:"cliente",width:20},
    {header:"Cantidad",key:"cant",width:12},{header:"Unidad",key:"unidad",width:10},
    {header:"Precio Unitario",key:"precio",width:16},{header:"Total Venta",key:"total",width:15},
    {header:"Costo",key:"costo",width:14},{header:"Ganancia",key:"gan",width:14},
    {header:"Observación",key:"obs",width:25}
  ];
  headerRow(wsV, "FF27ae60");
  let totV=0,totCosV=0,totGanV=0;
  ventas.forEach(v=>{
    const row=wsV.addRow({fecha:v.fecha,dia:v.diaSemana||"",prod:v.productoNombre,
      cliente:v.cliente||"",cant:v.cantidad,unidad:v.productoUnidad||"",
      precio:fmt(v.precioUnitario),total:fmt(v.total),costo:fmt(v.costoVenta),
      gan:fmt(v.gananciaVenta),obs:v.observacion||""});
    ["precio","total","costo","gan"].forEach(k=>{ row.getCell(k).numFmt="#,##0"; });
    if(v.gananciaVenta>=0) row.getCell("gan").font={color:{argb:"FF27ae60"},bold:true};
    totV+=v.total||0; totCosV+=v.costoVenta||0; totGanV+=v.gananciaVenta||0;
  });
  const trV=wsV.addRow({fecha:"",dia:"",prod:"TOTALES",cliente:"",cant:"",unidad:"",
    precio:"",total:totV,costo:totCosV,gan:totGanV,obs:""});
  trV.eachCell((c,i)=>{ c.font={bold:true}; if([8,9,10].includes(i)){c.numFmt="#,##0";c.fill=solidFill("FFFFD700");} });

  // ===== HOJA 3: GANANCIA POR PRODUCTO =====
  const wsGP = wb.addWorksheet("Ganancia por Producto");
  wsGP.columns = [
    {header:"Producto",key:"prod",width:25},{header:"N° Ventas",key:"cnt",width:12},
    {header:"Cantidad Total",key:"cant",width:16},{header:"Ingresos",key:"ing",width:16},
    {header:"Costo",key:"costo",width:16},{header:"Ganancia",key:"gan",width:16},{header:"% Margen",key:"margen",width:13}
  ];
  headerRow(wsGP, "FF0f1923");
  const porProd={};
  ventas.forEach(v=>{
    if(!porProd[v.productoNombre]) porProd[v.productoNombre]={cnt:0,cant:0,ing:0,costo:0,gan:0};
    porProd[v.productoNombre].cnt++;
    porProd[v.productoNombre].cant+=v.cantidad||0;
    porProd[v.productoNombre].ing +=v.total||0;
    porProd[v.productoNombre].costo+=v.costoVenta||0;
    porProd[v.productoNombre].gan  +=v.gananciaVenta||0;
  });
  Object.entries(porProd).sort((a,b)=>b[1].gan-a[1].gan).forEach(([nom,d])=>{
    const margen = d.ing>0?((d.gan/d.ing)*100).toFixed(1)+"%" : "0%";
    const row=wsGP.addRow({prod:nom,cnt:d.cnt,cant:Number(d.cant.toFixed(2)),ing:fmt(d.ing),costo:fmt(d.costo),gan:fmt(d.gan),margen});
    ["ing","costo","gan"].forEach(k=>{row.getCell(k).numFmt="#,##0";});
    row.getCell("gan").font={bold:true,color:{argb:d.gan>=0?"FF27ae60":"FFc0392b"}};
  });

  // ===== HOJA 4: INVENTARIO ACTUAL =====
  const wsI = wb.addWorksheet("Inventario Actual");
  wsI.columns = [
    {header:"Producto",key:"nom",width:25},{header:"Categoría",key:"cat",width:22},
    {header:"Tipo",key:"tipo",width:12},{header:"Unidad",key:"unidad",width:12},
    {header:"Stock Actual",key:"stock",width:14},{header:"Stock Mínimo",key:"min",width:14},
    {header:"Costo Unitario",key:"cu",width:16},{header:"Capital en Stock",key:"cap",width:18},
    {header:"Estado",key:"estado",width:14}
  ];
  headerRow(wsI, "FFe67e22");
  let totalCap=0;
  productos.forEach(p=>{
    const cap=(p.stock||0)*(p.costoUnitario||0);
    const estado=p.stock<=0?"Sin stock":p.stock<=(p.stockMin||0)?"Stock bajo":"OK";
    const row=wsI.addRow({nom:p.nombre,cat:p.categoria,tipo:p.tipoStock,unidad:p.unidad,
      stock:p.stock||0,min:p.stockMin||0,cu:fmt(p.costoUnitario||0),cap:fmt(cap),estado});
    row.getCell("cu").numFmt="#,##0"; row.getCell("cap").numFmt="#,##0";
    if(estado==="Sin stock") row.getCell("estado").fill=solidFill("FFfecaca");
    else if(estado==="Stock bajo") row.getCell("estado").fill=solidFill("FFfef3cd");
    else row.getCell("estado").fill=solidFill("FFd1fae5");
    totalCap+=cap;
  });
  const trI=wsI.addRow({nom:"CAPITAL TOTAL EN STOCK",cat:"",tipo:"",unidad:"",stock:"",min:"",cu:"",cap:fmt(totalCap),estado:""});
  trI.getCell("cap").numFmt="#,##0"; trI.eachCell(c=>c.font={bold:true}); trI.getCell("cap").fill=solidFill("FFFFD700");

  // ===== HOJA 5: COMPRAS =====
  const wsC = wb.addWorksheet("Compras");
  wsC.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:11},
    {header:"Producto",key:"prod",width:22},{header:"Proveedor",key:"prov",width:20},
    {header:"Cantidad",key:"cant",width:12},{header:"Unidad",key:"unidad",width:10},
    {header:"Costo Unitario",key:"cu",width:16},{header:"Costo Total",key:"total",width:15},
    {header:"Observación",key:"obs",width:30}
  ];
  headerRow(wsC,"FF2980b9");
  let totC=0;
  compras.forEach(c=>{
    const row=wsC.addRow({fecha:c.fecha,dia:c.diaSemana||"",prod:c.productoNombre,
      prov:c.proveedor||"",cant:c.cantidad,unidad:c.productoUnidad||"",
      cu:fmt(c.costoUnitario),total:fmt(c.costoTotal),obs:c.observacion||""});
    ["cu","total"].forEach(k=>{row.getCell(k).numFmt="#,##0";});
    totC+=c.costoTotal||0;
  });
  const trC=wsC.addRow({fecha:"",dia:"",prod:"TOTAL COMPRAS",prov:"",cant:"",unidad:"",cu:"",total:totC,obs:""});
  trC.eachCell((c,i)=>{c.font={bold:true};if(i===8){c.numFmt="#,##0";c.fill=solidFill("FFFFD700");}});

  // ===== HOJA 6: GASTOS =====
  const wsGas = wb.addWorksheet("Gastos Varios");
  wsGas.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:11},
    {header:"Categoría",key:"cat",width:25},{header:"Monto",key:"monto",width:16},
    {header:"Descripción",key:"desc",width:35}
  ];
  headerRow(wsGas,"FFc0392b");
  let totGas=0;
  gastos.forEach(g=>{
    const row=wsGas.addRow({fecha:g.fecha,dia:g.diaSemana||"",cat:g.categoria,monto:fmt(g.monto),desc:g.descripcion||""});
    row.getCell("monto").numFmt="#,##0"; totGas+=g.monto||0;
  });
  const trGas=wsGas.addRow({fecha:"",dia:"",cat:"TOTAL GASTOS",monto:totGas,desc:""});
  trGas.eachCell((c,i)=>{c.font={bold:true};if(i===4){c.numFmt="#,##0";c.fill=solidFill("FFFFD700");}});

  // ===== HOJA 7: CUENTAS POR COBRAR =====
  const wsCC = wb.addWorksheet("Cuentas por Cobrar");
  wsCC.columns = [
    {header:"Fecha Venta",key:"fecha",width:14},{header:"Cliente",key:"cli",width:22},
    {header:"Producto",key:"prod",width:22},{header:"Monto",key:"monto",width:16},
    {header:"Fecha Pago",key:"pago",width:14},{header:"Estado",key:"est",width:12},
    {header:"Observación",key:"obs",width:30}
  ];
  headerRow(wsCC,"FFe67e22");
  cobros.forEach(c=>{
    const row=wsCC.addRow({fecha:c.fecha,cli:c.cliente,prod:c.productoNombre||"",
      monto:fmt(c.monto),pago:c.fechaPago||"",est:c.estado?.toUpperCase(),obs:c.observacion||""});
    row.getCell("monto").numFmt="#,##0";
    row.getCell("est").fill=c.estado==="pendiente"?solidFill("FFfef3cd"):solidFill("FFd1fae5");
  });
  const pendMonto=cobros.filter(c=>c.estado==="pendiente").reduce((s,c)=>s+(c.monto||0),0);
  const trCC=wsCC.addRow({fecha:"",cli:"PENDIENTE POR COBRAR",prod:"",monto:pendMonto,pago:"",est:"",obs:""});
  trCC.eachCell((c,i)=>{c.font={bold:true};if(i===4){c.numFmt="#,##0";c.fill=solidFill("FFFFD700");}});

  // Descargar
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`materiales_${desde}_${hasta}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500);
  alert("✅ Excel exportado con 7 hojas:\n1. Resumen Ejecutivo\n2. Ventas\n3. Ganancia por Producto\n4. Inventario\n5. Compras\n6. Gastos\n7. Cuentas por Cobrar");
};

// ===== HELPERS =====
function solidFill(a){return{type:"pattern",pattern:"solid",fgColor:{argb:a}};}
function headerRow(ws,color){ws.getRow(1).height=20;ws.getRow(1).eachCell(c=>{c.fill=solidFill(color);c.font={bold:true,color:{argb:"FFFFFFFF"},size:10};c.alignment={vertical:"middle",horizontal:"center"};});}
function addTitulo(ws,txt,color){const r=ws.addRow([txt,""]);r.font={bold:true,size:13,color:{argb:"FFFFFFFF"}};r.fill=solidFill(color);ws.mergeCells(`A${r.number}:B${r.number}`);}
function addFilaResumen(ws,lbl,val,color){const r=ws.addRow([lbl,val]);r.getCell(1).font={bold:true};r.getCell(2).numFmt="#,##0";r.getCell(2).fill=solidFill(color);r.getCell(2).font={bold:true,color:{argb:"FFFFFFFF"}};r.getCell(2).alignment={horizontal:"right"};}
function addFilaInfo(ws,lbl,val){const r=ws.addRow([lbl,val]);r.getCell(1).font={bold:true};r.getCell(2).font={bold:true,color:{argb:"FF2980b9"}};}
