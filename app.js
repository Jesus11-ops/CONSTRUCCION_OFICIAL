import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy,
  deleteDoc, doc, updateDoc, getDoc, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const ADMIN_EMAIL = "Adminventas@gmail.com";

// ===== ESTADO GLOBAL =====
let esAdmin = false;
let productosGlobal = [];
let ventasGlobal    = [];
let comprasGlobal   = [];
let gastosGlobal    = [];
let cobrosGlobal    = [];
let filtroDesde = null;
let filtroHasta = null;

// ===== PRODUCTOS PREDEFINIDOS (de tu Excel) =====
const PRODUCTOS_INICIALES = [
  { nombre: "Gravilla",        categoria: "Áridos y Graneles",   unidad: "Lata",   tipoStock: "granel",   stockMin: 10, descripcion: "Gravilla por latas/galones" },
  { nombre: "Cemento",         categoria: "Cementos y Pegantes", unidad: "Bulto",  tipoStock: "contable", stockMin: 5,  descripcion: "Bultos de cemento gris" },
  { nombre: "Barilla / Varilla", categoria: "Hierros y Metales", unidad: "Unidad", tipoStock: "contable", stockMin: 10, descripcion: "Varillas de hierro" },
  { nombre: "Tubo",            categoria: "Tubería y Plomería",  unidad: "Unidad", tipoStock: "contable", stockMin: 5,  descripcion: "Tubos PVC/galvanizados" },
  { nombre: "Codo",            categoria: "Tubería y Plomería",  unidad: "Unidad", tipoStock: "contable", stockMin: 10, descripcion: "Codos de tubería" },
  { nombre: "Torofil (Galón)", categoria: "Pinturas",            unidad: "Galón",  tipoStock: "contable", stockMin: 3,  descripcion: "Torofil en galón" },
  { nombre: "Unión Amarilla",  categoria: "Tubería y Plomería",  unidad: "Unidad", tipoStock: "contable", stockMin: 5,  descripcion: "Unión amarilla PVC" },
  { nombre: "Acronal",         categoria: "Pinturas",            unidad: "Galón",  tipoStock: "contable", stockMin: 2,  descripcion: "Acronal pegante" },
  { nombre: "Soldadura",       categoria: "Hierros y Metales",   unidad: "Kilogramo", tipoStock: "contable", stockMin: 2, descripcion: "Soldadura para metales" },
  { nombre: "Arena",           categoria: "Áridos y Graneles",   unidad: "Metro³", tipoStock: "granel",   stockMin: 2,  descripcion: "Arena de río o peña" },
  { nombre: "Palautre",        categoria: "Herramientas",        unidad: "Unidad", tipoStock: "contable", stockMin: 2,  descripcion: "Palutre para construcción" },
  { nombre: "Rejilla 20x20",   categoria: "Otros",               unidad: "Unidad", tipoStock: "contable", stockMin: 5,  descripcion: "Rejilla metálica 20x20" },
];

// ===== FORMATO MONEDA =====
function fmt(n) { return "$" + Number(n || 0).toLocaleString("es-CO"); }
function parseMonto(str) { return Number(String(str).replace(/\D/g, "")) || 0; }
function hoy() { return new Date().toISOString().split("T")[0]; }
function getDia(f) {
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const [a,m,d] = f.split("-");
  return dias[new Date(a, m-1, d).getDay()];
}

// ===== AUTH =====
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = "index.html"; return; }
  esAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const badge = document.getElementById("rolBadge");
  if (badge) {
    badge.textContent = esAdmin ? "👑 Administrador" : "👁️ Empleado";
    badge.className   = esAdmin ? "rol-badge admin" : "rol-badge lectura";
  }

  document.getElementById("btnNuevoProducto") && (document.getElementById("btnNuevoProducto").style.display = esAdmin ? "inline-block" : "none");
  document.getElementById("formCompraAdmin")  && (document.getElementById("formCompraAdmin").style.display  = esAdmin ? "block" : "none");
  document.getElementById("formGastoAdmin")   && (document.getElementById("formGastoAdmin").style.display   = esAdmin ? "block" : "none");

  iniciarFechasFiltro();
  await verificarProductosIniciales();
  iniciarListeners();
});

window.cerrarSesion = async () => { await signOut(auth); window.location.href = "index.html"; };

// ===== PRODUCTOS INICIALES =====
async function verificarProductosIniciales() {
  const snap = await getDocs(collection(db, "Productos"));
  if (snap.empty && esAdmin) {
    for (const p of PRODUCTOS_INICIALES) {
      await addDoc(collection(db, "Productos"), { ...p, stock: 0, costoUnitario: 0, creadoEn: new Date().toISOString() });
    }
  }
}

// ===== FECHAS FILTRO =====
function iniciarFechasFiltro() {
  const now  = new Date();
  const ini  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const fin  = hoy();
  filtroDesde = ini; filtroHasta = fin;
  ["fechaDesde","informeDesde","ventaFiltroDesde"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ini; });
  ["fechaHasta","informeHasta","ventaFiltroHasta"].forEach(id => { const el = document.getElementById(id); if(el) el.value = fin; });
  ["ingresoFecha","ventaFecha","compraFecha","egresoFecha","gastoFecha"].forEach(id => { const el = document.getElementById(id); if(el) el.value = hoy(); });
}

window.filtroMesActual = () => { iniciarFechasFiltro(); actualizarResumen(); };
window.aplicarFiltro = () => {
  filtroDesde = document.getElementById("fechaDesde")?.value || filtroDesde;
  filtroHasta = document.getElementById("fechaHasta")?.value || filtroHasta;
  actualizarResumen();
};

// ===== LISTENERS =====
function iniciarListeners() {
  onSnapshot(query(collection(db, "Productos"), orderBy("nombre")), snap => {
    productosGlobal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProductos(); poblarSelectsProductos(); actualizarResumen();
  });
  onSnapshot(query(collection(db, "Ventas"),   orderBy("fecha","desc")), snap => { ventasGlobal   = snap.docs.map(d=>({id:d.id,...d.data()})); renderVentas(); actualizarResumen(); });
  onSnapshot(query(collection(db, "Compras"),  orderBy("fecha","desc")), snap => { comprasGlobal  = snap.docs.map(d=>({id:d.id,...d.data()})); renderCompras(); actualizarResumen(); });
  onSnapshot(query(collection(db, "Gastos"),   orderBy("fecha","desc")), snap => { gastosGlobal   = snap.docs.map(d=>({id:d.id,...d.data()})); renderGastos(); actualizarResumen(); });
  onSnapshot(query(collection(db, "CuentasCobrar"), orderBy("fecha","desc")), snap => { cobrosGlobal = snap.docs.map(d=>({id:d.id,...d.data()})); actualizarResumen(); });
}

// ===== RESUMEN =====
function enPeriodo(fecha) {
  if (!filtroDesde || !filtroHasta) return true;
  return fecha >= filtroDesde && fecha <= filtroHasta;
}

function actualizarResumen() {
  const ventasPer   = ventasGlobal.filter(v => enPeriodo(v.fecha));
  const comprasPer  = comprasGlobal.filter(c => enPeriodo(c.fecha));
  const gastosPer   = gastosGlobal.filter(g => enPeriodo(g.fecha));

  const totalVentas  = ventasPer.reduce((s,v) => s + (v.total||0), 0);
  const totalCompras = comprasPer.reduce((s,c) => s + (c.costoTotal||0), 0);
  const totalGastos  = gastosPer.reduce((s,g)  => s + (g.monto||0), 0);

  // ── Contables (varillas, cemento): ganancia = precio venta − costo unitario × cantidad
  const gananciaContable = ventasPer
    .filter(v => v.tipoStock !== "granel")
    .reduce((s,v) => s + (v.gananciaVenta||0), 0);

  // ── Granel (gravilla, arena): ganancia = ventas de granel − compras granel del período
  // Si aún no recuperaste lo del volco, el saldo será negativo (normal)
  const ventasGranelPer  = ventasPer.filter(v => v.tipoStock === "granel").reduce((s,v) => s+(v.total||0), 0);
  const comprasGranelPer = comprasPer.filter(c => c.tipoCompra === "granel").reduce((s,c) => s+(c.costoTotal||0), 0);
  const gananciaGranel   = ventasGranelPer - comprasGranelPer;

  // Ganancia neta total = contable + granel − gastos operativos
  const ganancia = gananciaContable + gananciaGranel - totalGastos;

  setText("resIngresos",  fmt(totalVentas));
  setText("resCompras",   fmt(totalCompras));
  setText("resGastos",    fmt(totalGastos));
  setText("resGanancia",  fmt(ganancia));
  setText("resCntVentas",  ventasPer.length  + " ventas");
  setText("resCntCompras", comprasPer.length + " compras");
  setText("resCntGastos",  gastosPer.length  + " gastos");

  const card = document.getElementById("cardGanancia");
  if (card) card.className = "res-card " + (ganancia >= 0 ? "azul" : "rojo");

  // ── CAJA Y CAPITAL ──
  const comprasDeCaja    = comprasPer.reduce((s,c) => s + (c.montoDeCaja    || (c.fuenteDinero==="caja"    ? c.costoTotal : 0) || 0), 0);
  const comprasDeCapital = comprasPer.reduce((s,c) => s + (c.montoDeCapital || (c.fuenteDinero==="capital" ? c.costoTotal : 0) || 0), 0);
  const gastosDeCaja     = gastosPer.reduce((s,g) => {
    if (!g.fuenteDinero || g.fuenteDinero === "caja") return s + (g.monto||0);
    if (g.fuenteDinero === "capital") return s;
    // mixto: usar montoDeCaja si existe
    return s + (g.montoDeCaja || 0);
  }, 0);
  const gastosDeCapital  = gastosPer.reduce((s,g) => {
    if (g.fuenteDinero === "capital") return s + (g.monto||0);
    if (g.fuenteDinero === "mixto")   return s + (g.montoDeCapital||0);
    return s;
  }, 0);
  const cajaSaldo        = totalVentas - comprasDeCaja - gastosDeCaja;

  setText("cajaSaldo",        fmt(cajaSaldo));
  setText("capitalExterno",   fmt(comprasDeCapital + gastosDeCapital));
  setText("comprasDeCaja",    fmt(comprasDeCaja));
  setText("comprasDeCapital", fmt(comprasDeCapital));

  const cajaSaldoEl = document.getElementById("cajaSaldo");
  if (cajaSaldoEl) cajaSaldoEl.style.color = cajaSaldo >= 0 ? "#1e8449" : "#c0392b";

  const alertaCaja = document.getElementById("alertaCaja");
  if (alertaCaja) {
    if (cajaSaldo < 0) {
      alertaCaja.style.display = "block";
      alertaCaja.textContent = `⚠️ Tu caja está en negativo (${fmt(cajaSaldo)}). Has gastado más en compras y gastos de lo que has recaudado en ventas en este período.`;
    } else {
      alertaCaja.style.display = "none";
    }
  }

  const comprasSinFuente = comprasPer.filter(c => !c.fuenteDinero).length;
  const gastosSinFuente  = gastosPer.filter(g => !g.fuenteDinero).length;
  const subEl = document.getElementById("cajaSub");
  if (subEl) {
    const total = comprasSinFuente + gastosSinFuente;
    subEl.textContent = total > 0
      ? `⚠️ ${total} registro(s) sin fuente de dinero`
      : "Ventas cobradas − compras de caja − gastos de caja";
    subEl.style.color = total > 0 ? "#c0392b" : "#6b7c93";
  }

  // Capital en stock
  const capital = productosGlobal.reduce((s,p) => s + ((p.stock||0) * (p.costoUnitario||0)), 0);
  setText("capitalStock", fmt(capital));
  const totalProd = productosGlobal.length;
  setText("capitalSub", totalProd + " productos en inventario");

  renderStockBajo();
  renderTopProductos(ventasPer);
}

function renderStockBajo() {
  const container = document.getElementById("stockBajo"); if(!container) return;
  const bajos = productosGlobal.filter(p => (p.stock||0) <= (p.stockMin||0));
  if (!bajos.length) { container.innerHTML = '<p style="color:#27ae60;font-size:0.88rem">✅ Todos los productos tienen stock suficiente.</p>'; return; }
  container.innerHTML = bajos.map(p => `
    <div class="stock-bajo-item">
      <span style="font-weight:600">${p.nombre}</span>
      <span class="badge-bajo">Stock: ${p.stock||0} ${p.unidad}</span>
    </div>`).join("");
}

function renderTopProductos(ventasPer) {
  const container = document.getElementById("topProductos"); if(!container) return;
  const comprasPer = comprasGlobal.filter(c => enPeriodo(c.fecha));
  const agrup = {};

  ventasPer.forEach(v => {
    if (!agrup[v.productoNombre]) agrup[v.productoNombre] = {
      ventas:0, ingresos:0, ganancia:0,
      esGranel: v.tipoStock==="granel",
      invertido:0, cantidadVendida:0
    };
    agrup[v.productoNombre].ventas++;
    agrup[v.productoNombre].ingresos += (v.total||0);
    agrup[v.productoNombre].cantidadVendida += (v.cantidad||0);
    if (v.tipoStock !== "granel") agrup[v.productoNombre].ganancia += (v.gananciaVenta||0);
  });

  // Para granel: acumular lo invertido (compras del período)
  comprasPer.filter(c => c.tipoCompra === "granel").forEach(c => {
    if (agrup[c.productoNombre]) {
      agrup[c.productoNombre].invertido += (c.costoTotal||0);
      agrup[c.productoNombre].ganancia  -= (c.costoTotal||0);
    }
  });

  // Para contable: acumular inversión total del período (todas las compras del período)
  // y también buscar el lote activo en TODOS los comprasGlobal para mostrar recuperación real
  comprasPer.filter(c => c.tipoCompra !== "granel").forEach(c => {
    if (agrup[c.productoNombre]) {
      agrup[c.productoNombre].invertido += (c.costoTotal||0);
    }
  });

  const lista = Object.entries(agrup).sort((a,b) => b[1].ingresos - a[1].ingresos).slice(0,6);
  if (!lista.length) { container.innerHTML = '<p class="empty-txt">Sin ventas en el período seleccionado.</p>'; return; }

  container.innerHTML = lista.map(([nombre, d], i) => {
    const invertido  = d.invertido;
    const recuperado = d.ingresos;
    // Ganancia real = lo recuperado - lo invertido (en el período)
    const gananciaReal = recuperado - invertido;
    const pct = invertido > 0 ? Math.min(100, Math.round((recuperado / invertido) * 100)) : (recuperado > 0 ? 100 : 0);
    const enGanancia = gananciaReal >= 0;

    // Color de barra: verde al llegar a 100%+, naranja >60%, rojo <60%
    const barColor = pct >= 100 ? '#27ae60' : (pct > 60 ? '#f39c12' : '#e74c3c');

    if (d.esGranel) {
      return `
      <div class="top-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="top-item-nombre">${i+1}. ${nombre} <span style="font-size:0.7rem;background:#fff3cd;color:#7c5e00;border-radius:4px;padding:1px 6px;font-weight:600">granel</span></div>
          <span style="font-size:0.82rem;color:#6b7c93">${d.ventas} ventas</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;flex-wrap:wrap;gap:4px">
          <span>💰 Invertido: <strong>${fmt(invertido)}</strong></span>
          <span>💵 Recuperado: <strong style="color:#2980b9">${fmt(recuperado)}</strong></span>
          <span style="font-weight:700;color:${enGanancia?'#27ae60':'#e74c3c'}">${enGanancia ? '✅ Ganancia: '+fmt(gananciaReal) : '⏳ Por recuperar: '+fmt(Math.abs(gananciaReal))}</span>
        </div>
        <div style="background:#e9ecef;border-radius:20px;height:10px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:20px;transition:width 0.4s ease"></div>
        </div>
        <div style="font-size:0.75rem;color:#6b7c93;text-align:right">${pct}% recuperado del cargamento</div>
      </div>`;
    } else {
      // Contable (cemento, varillas, etc.)
      // Si hay inversión registrada en el período, mostramos el tracker de recuperación
      if (invertido > 0) {
        return `
        <div class="top-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="top-item-nombre">${i+1}. ${nombre}</div>
            <span style="font-size:0.82rem;color:#6b7c93">${d.ventas} ventas · ${d.cantidadVendida} unid.</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;flex-wrap:wrap;gap:4px">
            <span>💰 Invertido: <strong>${fmt(invertido)}</strong></span>
            <span>💵 Recuperado: <strong style="color:#2980b9">${fmt(recuperado)}</strong></span>
            <span style="font-weight:700;color:${enGanancia?'#27ae60':'#e74c3c'}">${enGanancia ? '✅ Ganancia: '+fmt(gananciaReal) : '⏳ Por recuperar: '+fmt(Math.abs(gananciaReal))}</span>
          </div>
          <div style="background:#e9ecef;border-radius:20px;height:10px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:20px;transition:width 0.4s ease"></div>
          </div>
          <div style="font-size:0.75rem;color:#6b7c93;text-align:right">${pct}% recuperado de la inversión del período</div>
        </div>`;
      } else {
        // Sin compras registradas en el período: mostrar modo simple con nota
        return `
        <div class="top-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="top-item-nombre">${i+1}. ${nombre}</div>
            <span style="font-size:0.82rem;color:#6b7c93">${d.ventas} ventas · ${fmt(recuperado)}</span>
          </div>
          <div style="font-size:0.78rem;color:#e67e22;background:#fff8e1;border-radius:6px;padding:5px 8px">
            ⚠️ No hay compras registradas en este período. Registra la compra del lote para ver cuánto falta por recuperar.
          </div>
        </div>`;
      }
    }
  }).join("");
}

// ===== NAVEGACIÓN =====
window.mostrarSeccion = function(id) {
  document.querySelectorAll(".seccion").forEach(s => s.style.display = "none");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const sec = document.getElementById("sec-" + id);
  if (sec) sec.style.display = "block";
  const btn = document.querySelector(`[data-section="${id}"]`);
  if (btn) btn.classList.add("active");
};

// ===== FORMATOS INPUTS =====
function aplicarFormateo(inputId, hiddenId) {
  const inp = document.getElementById(inputId); if(!inp) return;
  inp.addEventListener("input", function() {
    const n = parseMonto(this.value);
    this.value = n ? n.toLocaleString("es-CO") : "";
    const h = document.getElementById(hiddenId); if(h) h.value = n;
  });
}

// ===== INVENTARIO =====
window.mostrarFormProducto = () => {
  const f = document.getElementById("formNuevoProducto");
  if(f) f.style.display = f.style.display === "none" ? "block" : "none";
};
window.cancelarNuevoProducto = () => { document.getElementById("formNuevoProducto").style.display = "none"; };

window.guardarProducto = async function() {
  if (!esAdmin) { alert("⛔ Solo el administrador puede agregar productos."); return; }
  const nombre      = document.getElementById("prodNombre").value.trim();
  const categoria   = document.getElementById("prodCategoria").value;
  const unidad      = document.getElementById("prodUnidad").value;
  const tipoStock   = document.getElementById("prodTipoStock").value;
  const stockMin    = Number(document.getElementById("prodStockMin").value)||0;
  const descripcion = document.getElementById("prodDescripcion").value.trim();
  if (!nombre) { alert("⚠️ Ingrese el nombre del producto"); return; }
  if (!categoria) { alert("⚠️ Seleccione la categoría"); return; }
  try {
    await addDoc(collection(db,"Productos"), { nombre, categoria, unidad, tipoStock, stockMin, descripcion, stock:0, costoUnitario:0, creadoEn: new Date().toISOString() });
    alert("✅ Producto creado: " + nombre);
    cancelarNuevoProducto();
    ["prodNombre","prodDescripcion"].forEach(id=>document.getElementById(id).value="");
    document.getElementById("prodStockMin").value="0";
  } catch(e) { alert("❌ Error: "+e.message); }
};

function renderProductos() {
  const container = document.getElementById("listaProductos"); if(!container) return;
  let lista = [...productosGlobal];
  const buscar = document.getElementById("buscarProducto")?.value.toLowerCase()||"";
  const cat    = document.getElementById("filtroCategoria")?.value||"";
  if (buscar) lista = lista.filter(p => p.nombre.toLowerCase().includes(buscar));
  if (cat)    lista = lista.filter(p => p.categoria === cat);
  if (!lista.length) { container.innerHTML = '<p class="empty-txt">No hay productos que coincidan.</p>'; return; }

  container.innerHTML = lista.map(p => {
    const stock = p.stock || 0;
    const min   = p.stockMin || 0;
    let stockCls = "prod-stock-ok", stockLbl = "✅ OK";
    if (stock <= 0)   { stockCls = "prod-stock-low";  stockLbl = "⛔ Sin stock"; }
    else if (stock <= min) { stockCls = "prod-stock-warn"; stockLbl = "⚠️ Bajo"; }

    const tipoTag = p.tipoStock === "granel"
      ? '<span class="tag-granel">A granel</span>'
      : '<span class="tag-contable">Contable</span>';

    return `
    <div class="prod-card">
      <div class="prod-head">
        <div class="prod-nombre">${p.nombre} ${tipoTag}</div>
        <div class="prod-cat">${p.categoria} · ${p.unidad}</div>
      </div>
      <div class="prod-body">
        <div class="prod-fila"><span class="prod-lbl">Stock actual</span><span class="prod-val ${stockCls}">${stock} ${p.unidad} ${stockLbl}</span></div>
        <div class="prod-fila"><span class="prod-lbl">Mín. alerta</span><span class="prod-val">${min} ${p.unidad}</span></div>
        <div class="prod-fila"><span class="prod-lbl">Costo unitario</span><span class="prod-val">${fmt(p.costoUnitario||0)}</span></div>
        <div class="prod-fila"><span class="prod-lbl">Capital en stock</span><span class="prod-val">${fmt((p.stock||0)*(p.costoUnitario||0))}</span></div>
        ${p.descripcion ? `<div class="prod-fila"><span class="prod-lbl">Descripción</span><span class="prod-val">${p.descripcion}</span></div>` : ""}
      </div>
      ${esAdmin ? `
      <div class="prod-footer">
        <button class="btn-outline btn-sm" onclick="abrirEditarProducto('${p.id}')">✏️ Editar</button>
        <button class="btn-rojo btn-sm" onclick="eliminarProducto('${p.id}')">🗑️ Eliminar</button>
      </div>` : ""}
    </div>`;
  }).join("");
}

window.filtrarProductos = () => renderProductos();

window.abrirEditarProducto = async function(id) {
  const p = productosGlobal.find(x=>x.id===id); if(!p) return;
  document.getElementById("editProdId").value          = id;
  document.getElementById("editProdNombre").value      = p.nombre;
  document.getElementById("editProdCategoria").value   = p.categoria;
  document.getElementById("editProdStockMin").value    = p.stockMin||0;
  document.getElementById("editProdStockAjuste").value = "";
  document.getElementById("editProdDescripcion").value = p.descripcion||"";
  document.getElementById("modalEditarProducto").style.display = "flex";
};

window.guardarEdicionProducto = async function() {
  const id     = document.getElementById("editProdId").value;
  const nombre = document.getElementById("editProdNombre").value.trim();
  const cat    = document.getElementById("editProdCategoria").value;
  const min    = Number(document.getElementById("editProdStockMin").value)||0;
  const ajuste = document.getElementById("editProdStockAjuste").value;
  const desc   = document.getElementById("editProdDescripcion").value.trim();
  if (!nombre) { alert("⚠️ El nombre no puede quedar vacío"); return; }
  try {
    const upd = { nombre, categoria: cat, stockMin: min, descripcion: desc };
    if (ajuste !== "") upd.stock = parseFloat(ajuste);
    await updateDoc(doc(db,"Productos",id), upd);
    alert("✅ Producto actualizado");
    cerrarModal("modalEditarProducto");
  } catch(e) { alert("❌ Error: "+e.message); }
};

window.eliminarProducto = async function(id) {
  if (!esAdmin) return;
  if (!confirm("⚠️ ¿Eliminar este producto? Se perderá su historial de stock.")) return;
  await deleteDoc(doc(db,"Productos",id));
};

// ===== SELECTS PRODUCTOS =====
function poblarSelectsProductos() {
  ["ventaProducto","compraProducto"].forEach(sid => {
    const sel = document.getElementById(sid); if(!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">— Seleccione producto —</option>' +
      productosGlobal.map(p=>`<option value="${p.id}">${p.nombre} (Stock: ${p.stock||0} ${p.unidad})</option>`).join("");
    if (val) sel.value = val;
  });
}

// ===== VENTAS =====
window.cargarDatosProductoVenta = function() {
  const sel = document.getElementById("ventaProducto");
  const prod = productosGlobal.find(p=>p.id===sel.value);
  const info = document.getElementById("ventaStockInfo");
  if (prod && info) info.textContent = `Stock disponible: ${prod.stock||0} ${prod.unidad}`;
  calcularTotalVenta();
};

window.calcularTotalVenta = function() {
  const cant   = parseFloat(document.getElementById("ventaCantidad")?.value)||0;
  const precio = parseMonto(document.getElementById("ventaPrecio")?.value);
  const total  = cant * precio;
  document.getElementById("ventaTotal") && (document.getElementById("ventaTotal").textContent = fmt(total));
  // Actualizar hidden
  const h = document.getElementById("ventaPrecioValue"); if(h) h.value = precio;
};

window.guardarVenta = async function() {
  const fecha       = document.getElementById("ventaFecha").value;
  const cliente     = document.getElementById("ventaCliente").value.trim();
  const prodId      = document.getElementById("ventaProducto").value;
  const cantidad    = parseFloat(document.getElementById("ventaCantidad").value)||0;
  const precio      = parseMonto(document.getElementById("ventaPrecio").value);
  const observacion = document.getElementById("ventaObservacion").value.trim();

  if (!fecha)    { alert("⚠️ Ingrese la fecha"); return; }
  if (!prodId)   { alert("⚠️ Seleccione un producto"); return; }
  if (cantidad<=0){ alert("⚠️ Ingrese una cantidad válida"); return; }
  if (precio<=0)  { alert("⚠️ Ingrese el precio de venta"); return; }

  const prod = productosGlobal.find(p=>p.id===prodId);
  if (!prod) { alert("❌ Producto no encontrado"); return; }

  if (prod.tipoStock === "contable" && cantidad > (prod.stock||0)) {
    if (!confirm(`⚠️ El stock actual es ${prod.stock} ${prod.unidad}. ¿Deseas registrar la venta de todas formas?`)) return;
  }

  const total = cantidad * precio;
  // Granel (gravilla, arena): NO tiene costo por unidad.
  // La ganancia real se ve en el balance del período (ventas granel - compras granel).
  // Contable (varillas, cemento): sí tiene costo unitario conocido.
  const esGranel = prod.tipoStock === "granel";
  const costoVenta    = esGranel ? 0 : cantidad * (prod.costoUnitario||0);
  const gananciaVenta = esGranel ? 0 : total - costoVenta; // granel: ganancia = 0 aquí, se calcula en el balance

  try {
    await addDoc(collection(db,"Ventas"), {
      fecha, diaSemana: getDia(fecha), cliente, productoId: prodId,
      productoNombre: prod.nombre, productoUnidad: prod.unidad, tipoStock: prod.tipoStock,
      cantidad, precioUnitario: precio, total, costoVenta, gananciaVenta,
      observacion, estado: "pagado", creadoEn: new Date().toISOString()
    });

    // Reducir stock
    const nuevoStock = Math.max(0, (prod.stock||0) - cantidad);
    await updateDoc(doc(db,"Productos",prodId), { stock: nuevoStock });

    alert("✅ Venta registrada\n" + prod.nombre + " · " + fmt(total));
    limpiarFormVenta();
  } catch(e) { alert("❌ Error: "+e.message); }
};

function limpiarFormVenta() {
  ["ventaCliente","ventaObservacion"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  ["ventaProducto"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  ["ventaCantidad"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  ["ventaPrecio"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
  document.getElementById("ventaTotal") && (document.getElementById("ventaTotal").textContent="$0");
  document.getElementById("ventaStockInfo") && (document.getElementById("ventaStockInfo").textContent="");
  document.getElementById("ventaFecha") && (document.getElementById("ventaFecha").value=hoy());
}

function renderVentas(lista) {
  const container = document.getElementById("listaVentas"); if(!container) return;
  let data = lista ? [...lista] : [...ventasGlobal];
  data.sort((a,b) => {
    if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
    return (b.creadoEn||"").localeCompare(a.creadoEn||"");
  });
  if (!data.length) { container.innerHTML='<p class="empty-txt">No hay ventas registradas.</p>'; return; }
  container.innerHTML = data.map(v => `
    <div class="reg-card">
      <div class="reg-head venta-h">
        <div class="reg-head-left">
          <h4>💰 ${v.productoNombre||"Venta"}</h4>
          <p>${v.diaSemana||""}, ${v.fecha||""} ${v.cliente ? "· Cliente: "+v.cliente : ""}</p>
        </div>
        <div class="reg-monto">${fmt(v.total)}</div>
      </div>
      <div class="reg-body">
        <div class="reg-dato"><div class="reg-dato-lbl">Cantidad</div><div class="reg-dato-val">${v.cantidad} ${v.productoUnidad||""}</div></div>
        <div class="reg-dato"><div class="reg-dato-lbl">Precio unitario</div><div class="reg-dato-val">${fmt(v.precioUnitario)}</div></div>
        ${v.tipoStock !== "granel" ? `
        <div class="reg-dato"><div class="reg-dato-lbl">Costo</div><div class="reg-dato-val">${fmt(v.costoVenta||0)}</div></div>
        <div class="reg-dato"><div class="reg-dato-lbl">Ganancia</div><div class="reg-dato-val" style="color:var(--verde)">${fmt(v.gananciaVenta||0)}</div></div>
        ` : `<div class="reg-dato full-col"><div class="reg-dato-lbl" style="color:#7c5e00">🪣 Granel — la ganancia se ve en el balance del período (ventas vs. compras del volco)</div></div>`}
        ${v.observacion?`<div class="reg-dato full-col"><div class="reg-dato-lbl">Observación</div><div class="reg-dato-val">${v.observacion}</div></div>`:""}
      </div>
      ${esAdmin?`<div class="reg-actions">
        <button class="btn-outline btn-sm" onclick="abrirEditarVenta('${v.id}')">✏️ Editar</button>
        <button class="btn-rojo btn-sm" onclick="eliminarVenta('${v.id}','${v.productoId}',${v.cantidad||0})">🗑️ Eliminar</button>
        <button class="btn-naranja btn-sm" onclick="convertirACuentaCobrar('${v.id}')">📋 Cuenta por cobrar</button>
      </div>`:""}
    </div>`).join("");
}

window.filtrarVentas = function() {
  const desde = document.getElementById("ventaFiltroDesde")?.value;
  const hasta = document.getElementById("ventaFiltroHasta")?.value;
  let lista = [...ventasGlobal];
  if (desde) lista = lista.filter(v=>v.fecha>=desde);
  if (hasta) lista = lista.filter(v=>v.fecha<=hasta);
  lista.sort((a,b) => {
    if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
    return (b.creadoEn||"").localeCompare(a.creadoEn||"");
  });
  renderVentas(lista);
};

window.abrirEditarVenta = async function(id) {
  const v = ventasGlobal.find(x=>x.id===id); if(!v) return;
  document.getElementById("editVentaId").value          = id;
  document.getElementById("editVentaCliente").value     = v.cliente||"";
  document.getElementById("editVentaPrecio").value      = (v.precioUnitario||0).toLocaleString("es-CO");
  document.getElementById("editVentaPrecioValue").value = v.precioUnitario||0;
  document.getElementById("editVentaObservacion").value = v.observacion||"";
  document.getElementById("modalEditarVenta").style.display = "flex";
};

window.guardarEdicionVenta = async function() {
  const id     = document.getElementById("editVentaId").value;
  const cliente = document.getElementById("editVentaCliente").value.trim();
  const precio  = parseMonto(document.getElementById("editVentaPrecio").value);
  const obs     = document.getElementById("editVentaObservacion").value.trim();
  const v       = ventasGlobal.find(x=>x.id===id); if(!v) return;
  const total   = (v.cantidad||0)*precio;
  const prod    = productosGlobal.find(p=>p.id===v.productoId);
  const costo   = (v.cantidad||0)*(prod?.costoUnitario||0);
  try {
    await updateDoc(doc(db,"Ventas",id), { cliente, precioUnitario:precio, total, gananciaVenta:total-costo, observacion:obs });
    alert("✅ Venta actualizada");
    cerrarModal("modalEditarVenta");
  } catch(e) { alert("❌ "+e.message); }
};

window.eliminarVenta = async function(id, prodId, cantidad) {
  if (!esAdmin) return;
  if (!confirm("⚠️ ¿Eliminar esta venta? El stock se devolverá.")) return;
  try {
    await deleteDoc(doc(db,"Ventas",id));
    if (prodId) {
      const prod = productosGlobal.find(p=>p.id===prodId);
      if (prod) await updateDoc(doc(db,"Productos",prodId), { stock: (prod.stock||0)+cantidad });
    }
    alert("✅ Venta eliminada y stock restaurado");
  } catch(e) { alert("❌ "+e.message); }
};

// ===== CUENTAS POR COBRAR =====
window.convertirACuentaCobrar = async function(ventaId) {
  const v = ventasGlobal.find(x=>x.id===ventaId); if(!v) return;
  const cliente = prompt("👤 Nombre del cliente:", v.cliente||"");
  if (cliente===null) return;
  const plazo = prompt("📅 Fecha de pago acordada:", hoy());
  if (plazo===null) return;
  try {
    await addDoc(collection(db,"CuentasCobrar"), {
      fecha: v.fecha, fechaPago: plazo, cliente: cliente||v.cliente||"Sin nombre",
      productoNombre: v.productoNombre, monto: v.total,
      observacion: "Venta del "+v.fecha, estado: "pendiente",
      ventaId, creadoEn: new Date().toISOString()
    });
    alert("✅ Cuenta por cobrar registrada para " + (cliente||"el cliente"));
  } catch(e) { alert("❌ "+e.message); }
};

// ===== COMPRAS =====
window.cargarUnidadCompra = function() {
  const sel  = document.getElementById("compraProducto");
  const prod = productosGlobal.find(p => p.id === sel.value);
  const info = document.getElementById("compraUnidadInfo");

  // Ocultar ambos bloques primero
  document.getElementById("bloqueContable").style.display = "none";
  document.getElementById("bloqueGranel").style.display   = "none";

  if (!prod) { if(info) info.textContent = ""; return; }

  if (info) info.textContent = `Stock actual: ${prod.stock||0} ${prod.unidad}`;

  if (prod.tipoStock === "granel") {
    document.getElementById("bloqueGranel").style.display = "block";
  } else {
    document.getElementById("bloqueContable").style.display = "block";
  }

  // Mostrar selector de fuente de dinero
  const bf = document.getElementById("bloqueFuente");
  if (bf) bf.style.display = "block";

  // Reset fuente selection
  document.querySelectorAll("input[name='fuenteDinero']").forEach(r => r.checked = false);
  const bm = document.getElementById("bloqueMixto"); if(bm) bm.style.display = "none";
  const fh = document.getElementById("fuenteHint"); if(fh) { fh.style.display="block"; fh.textContent="⚠️ Selecciona de dónde sale el dinero para esta compra"; }
};

// Fuente de dinero: mostrar/ocultar bloque mixto
window.actualizarFuente = function() {
  const val = document.querySelector("input[name='fuenteDinero']:checked")?.value;
  const bm = document.getElementById("bloqueMixto");
  if (bm) bm.style.display = val === "mixto" ? "block" : "none";
  const fh = document.getElementById("fuenteHint");
  if (fh) fh.style.display = val ? "none" : "block";
};

window.formatearMixto = function(inputId, hiddenSuffix) {
  const inp = document.getElementById(inputId); if(!inp) return;
  const n = parseMonto(inp.value);
  inp.value = n > 0 ? n.toLocaleString("es-CO") : inp.value;
  const h = document.getElementById(inputId + hiddenSuffix); if(h) h.value = n;
};

// Calcula el total cuando el admin escribe cantidad o precio unitario (modo contable)
window.calcularCostoUnitario = function() {
  const cant = parseFloat(document.getElementById("compraCantidad")?.value) || 0;
  const cu   = parseMonto(document.getElementById("compraCostoUnitarioInput")?.value) || 0;
  const total = cant * cu;
  const el = document.getElementById("compraTotalCalculado");
  if (el) el.textContent = fmt(total);
  const h = document.getElementById("compraCostoValue"); if(h) h.value = total;
};

// Formatea el campo de granel mientras escribe
window.formatearGranel = function() {
  const inp = document.getElementById("compraCostoGranel"); if(!inp) return;
  const n = parseMonto(inp.value);
  inp.value = n ? n.toLocaleString("es-CO") : "";
  const h = document.getElementById("compraCostoGranelValue"); if(h) h.value = n;
  const hc = document.getElementById("compraCostoValue"); if(hc) hc.value = n;
};

window.guardarCompra = async function() {
  if (!esAdmin) { alert("⛔ Solo el administrador puede registrar compras."); return; }

  const fecha     = document.getElementById("compraFecha").value;
  const proveedor = document.getElementById("compraProveedor").value.trim();
  const prodId    = document.getElementById("compraProducto").value;
  const obs       = document.getElementById("compraObservacion").value.trim();

  if (!fecha)  { alert("⚠️ Ingrese la fecha"); return; }
  if (!prodId) { alert("⚠️ Seleccione el producto"); return; }

  const prod = productosGlobal.find(p => p.id === prodId);
  if (!prod) { alert("❌ Producto no encontrado"); return; }

  let cantidad = 0, costoUnitario = 0, costoTotal = 0;

  if (prod.tipoStock === "granel") {
    // GRANEL: solo el total pagado, sin cantidad exacta
    costoTotal = parseMonto(document.getElementById("compraCostoGranel")?.value) ||
                 Number(document.getElementById("compraCostoGranelValue")?.value) || 0;
    if (costoTotal <= 0) { alert("⚠️ Ingrese lo que pagaste por este cargamento"); return; }
    cantidad     = 0;       // no aplica
    costoUnitario = 0;      // no aplica
  } else {
    // CONTABLE: cantidad × precio unitario
    cantidad      = parseFloat(document.getElementById("compraCantidad")?.value) || 0;
    costoUnitario = parseMonto(document.getElementById("compraCostoUnitarioInput")?.value) || 0;
    costoTotal    = cantidad * costoUnitario;

    if (cantidad <= 0)     { alert("⚠️ Ingrese la cantidad comprada"); return; }
    if (costoUnitario <= 0){ alert("⚠️ Ingrese el costo por unidad"); return; }
  }

  // Fuente de dinero
  const fuenteRad = document.querySelector("input[name='fuenteDinero']:checked");
  if (!fuenteRad) { alert("⚠️ Selecciona de dónde sale el dinero (Caja, Capital Externo o Mixto)"); return; }
  const fuenteDinero = fuenteRad.value;
  let montoDeCaja = 0, montoDeCapital = 0;
  if (fuenteDinero === "caja") {
    montoDeCaja = costoTotal;
  } else if (fuenteDinero === "capital") {
    montoDeCapital = costoTotal;
  } else {
    montoDeCaja    = Number(document.getElementById("fuenteMontoCaja_cajav")?.value) || 0;
    montoDeCapital = Number(document.getElementById("fuenteMontoCapital_capv")?.value) || 0;
    if (montoDeCaja <= 0 && montoDeCapital <= 0) { alert("⚠️ Ingresa los montos de Caja y/o Capital Externo"); return; }
  }

  try {
    // Guardar compra
    await addDoc(collection(db, "Compras"), {
      fecha, diaSemana: getDia(fecha), proveedor,
      productoId: prodId, productoNombre: prod.nombre, productoUnidad: prod.unidad,
      cantidad, costoUnitario, costoTotal,
      fuenteDinero, montoDeCaja, montoDeCapital,
      tipoCompra: prod.tipoStock === "granel" ? "granel" : "contable",
      observacion: obs, creadoEn: new Date().toISOString()
    });

    // Actualizar producto
    if (prod.tipoStock === "contable" && cantidad > 0) {
      const nuevoStock = (prod.stock || 0) + cantidad;
      // Promedio ponderado del costo
      const stockActual = prod.stock || 0;
      const costoActual = prod.costoUnitario || 0;
      const costoPromedio = stockActual > 0
        ? ((stockActual * costoActual) + costoTotal) / nuevoStock
        : costoUnitario;
      await updateDoc(doc(db, "Productos", prodId), { stock: nuevoStock, costoUnitario: costoPromedio });
      alert(`✅ Compra registrada\n📦 ${prod.nombre}\n🔢 +${cantidad} ${prod.unidad} · $${costoUnitario.toLocaleString("es-CO")} c/u\n💵 Total: ${fmt(costoTotal)}\n📊 Stock nuevo: ${nuevoStock}`);
    } else {
      // Granel: actualizar costo de referencia solamente
      await updateDoc(doc(db, "Productos", prodId), { ultimoCompraCosto: costoTotal });
      alert(`✅ Compra registrada\n🪣 ${prod.nombre} (granel)\n💵 Pagaste: ${fmt(costoTotal)}\n📈 La ganancia se verá conforme vayas vendiendo`);
    }

    limpiarFormCompra();
  } catch(e) { alert("❌ " + e.message); }
};

function limpiarFormCompra() {
  [["compraProveedor","compraObservacion","compraCantidad","compraCostoUnitarioInput","compraCostoGranel","fuenteMontoCaja","fuenteMontoCapital"]].flat().forEach(id => {
    const e = document.getElementById(id); if(e) e.value = "";
  });
  ["compraCostoValue","compraCostoGranelValue","fuenteMontoCaja_cajav","fuenteMontoCapital_capv"].forEach(id => {
    const e = document.getElementById(id); if(e) e.value = "";
  });
  document.querySelectorAll("input[name='fuenteDinero']").forEach(r => r.checked = false);
  const bm = document.getElementById("bloqueMixto"); if(bm) bm.style.display = "none";
  const bf = document.getElementById("bloqueFuente"); if(bf) bf.style.display = "none";
  const fh = document.getElementById("fuenteHint"); if(fh) { fh.style.display="block"; fh.textContent="⚠️ Selecciona de dónde sale el dinero para esta compra"; }
  const tc = document.getElementById("compraTotalCalculado"); if(tc) tc.textContent = "$0";
  document.getElementById("compraProducto") && (document.getElementById("compraProducto").value = "");
  document.getElementById("bloqueContable").style.display = "none";
  document.getElementById("bloqueGranel").style.display   = "none";
  document.getElementById("compraUnidadInfo") && (document.getElementById("compraUnidadInfo").textContent = "");
  document.getElementById("compraFecha") && (document.getElementById("compraFecha").value = hoy());
}

function renderCompras() {
  const container = document.getElementById("listaCompras"); if(!container) return;
  if (!comprasGlobal.length) { container.innerHTML='<p class="empty-txt">No hay compras registradas.</p>'; return; }
  const data = [...comprasGlobal].sort((a,b) => {
    if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
    return (b.creadoEn||"").localeCompare(a.creadoEn||"");
  });
  container.innerHTML = data.map(c => {
    const esGranel = c.tipoCompra === "granel" || !c.cantidad;
    return `
    <div class="reg-card">
      <div class="reg-head compra-h">
        <div class="reg-head-left">
          <h4>🛒 ${c.productoNombre||"Compra"} ${esGranel ? '<span style="font-size:0.72rem;background:#fff3cd;color:#7c5e00;border-radius:4px;padding:2px 6px;font-weight:600">GRANEL</span>' : ''}</h4>
          <p>${c.diaSemana||""}, ${c.fecha||""} ${c.proveedor ? "· "+c.proveedor : ""}</p>
        </div>
        <div class="reg-monto">${fmt(c.costoTotal)}</div>
      </div>
      <div class="reg-body">
        ${!esGranel ? `
          <div class="reg-dato"><div class="reg-dato-lbl">Cantidad</div><div class="reg-dato-val">${c.cantidad} ${c.productoUnidad||""}</div></div>
          <div class="reg-dato"><div class="reg-dato-lbl">Costo por unidad</div><div class="reg-dato-val">${fmt(c.costoUnitario)}</div></div>
          <div class="reg-dato"><div class="reg-dato-lbl">Total pagado</div><div class="reg-dato-val">${fmt(c.costoTotal)}</div></div>
        ` : `
          <div class="reg-dato"><div class="reg-dato-lbl">Total pagado</div><div class="reg-dato-val">${fmt(c.costoTotal)}</div></div>
          <div class="reg-dato"><div class="reg-dato-lbl">Tipo</div><div class="reg-dato-val">🪣 Cargamento granel</div></div>
        `}
        ${c.observacion ? `<div class="reg-dato"><div class="reg-dato-lbl">Observación</div><div class="reg-dato-val">${c.observacion}</div></div>` : ""}
        ${c.fuenteDinero ? (() => {
          const icons = {caja:"💰 Caja (ventas)", capital:"💼 Capital externo", mixto:`🔀 Mixto (Caja: ${fmt(c.montoDeCaja||0)} · Capital: ${fmt(c.montoDeCapital||0)})`};
          const colors = {caja:"#1e8449", capital:"#1a5276", mixto:"#6c3483"};
          return `<div class="reg-dato full-col"><div class="reg-dato-lbl">Fuente de dinero</div><div class="reg-dato-val" style="font-weight:700;color:${colors[c.fuenteDinero]||'#333'}">${icons[c.fuenteDinero]||c.fuenteDinero}</div></div>`;
        })() : `<div class="reg-dato full-col"><div class="reg-dato-lbl">Fuente de dinero</div><div class="reg-dato-val" style="color:#c0392b;font-size:0.82rem">⚠️ No registrada (compra antigua)</div></div>`}
      </div>
      ${esAdmin ? `<div class="reg-actions"><button class="btn-rojo btn-sm" onclick="eliminarCompra('${c.id}','${c.productoId}',${c.cantidad||0})">🗑️ Eliminar</button></div>` : ""}
    </div>`;
  }).join("");
}

window.eliminarCompra = async function(id, prodId, cantidad) {
  if (!esAdmin||!confirm("⚠️ ¿Eliminar esta compra? El stock se descontará.")) return;
  try {
    await deleteDoc(doc(db,"Compras",id));
    const prod = productosGlobal.find(p=>p.id===prodId);
    if (prod) await updateDoc(doc(db,"Productos",prodId), { stock: Math.max(0,(prod.stock||0)-cantidad) });
    alert("✅ Compra eliminada");
  } catch(e) { alert("❌ "+e.message); }
};

// ===== GASTOS =====
window.actualizarFuenteGasto = function() {
  const val = document.querySelector("input[name='gastoFuente']:checked")?.value;
  const bm  = document.getElementById("gastoBloqueMixto");
  const fh  = document.getElementById("gastoFuenteHint");
  if (bm) bm.style.display = val === "mixto" ? "block" : "none";
  if (fh) fh.style.display = val ? "none" : "block";
};

window.formatearMixtoGasto = function(inputId, hiddenSuffix) {
  const inp = document.getElementById(inputId); if (!inp) return;
  const n = parseMonto(inp.value);
  inp.value = n > 0 ? n.toLocaleString("es-CO") : inp.value;
  const h = document.getElementById(inputId + hiddenSuffix); if (h) h.value = n;
};

window.guardarGasto = async function() {
  if (!esAdmin) { alert("⛔ Solo el administrador puede registrar gastos."); return; }
  const fecha       = document.getElementById("gastoFecha").value;
  const categoria   = document.getElementById("gastoCategoria").value;
  const monto       = parseMonto(document.getElementById("gastoMonto").value);
  const descripcion = document.getElementById("gastoDescripcion").value.trim();

  if (!fecha)    { alert("⚠️ Ingrese la fecha"); return; }
  if (!categoria){ alert("⚠️ Seleccione la categoría"); return; }
  if (monto <= 0){ alert("⚠️ Ingrese el monto"); return; }

  // Fuente de dinero
  const fuenteRad = document.querySelector("input[name='gastoFuente']:checked");
  if (!fuenteRad) { alert("⚠️ Selecciona de dónde sale el dinero (Caja, Capital Propio o Mixto)"); return; }
  const fuenteDinero = fuenteRad.value;
  let montoDeCaja = 0, montoDeCapital = 0;
  if (fuenteDinero === "caja") {
    montoDeCaja = monto;
  } else if (fuenteDinero === "capital") {
    montoDeCapital = monto;
  } else {
    montoDeCaja    = Number(document.getElementById("gastoMontoCaja_gv")?.value)    || 0;
    montoDeCapital = Number(document.getElementById("gastoMontoCapital_gpv")?.value) || 0;
    if (montoDeCaja <= 0 && montoDeCapital <= 0) { alert("⚠️ Ingresa los montos de Caja y/o Capital Propio"); return; }
  }

  const iconFuente = { caja:"💰 Caja (ventas)", capital:"💼 Capital propio", mixto:`🔀 Mixto (Caja: ${fmt(montoDeCaja)} · Capital: ${fmt(montoDeCapital)})` };

  try {
    await addDoc(collection(db,"Gastos"), {
      fecha, diaSemana: getDia(fecha), categoria, monto, descripcion,
      fuenteDinero, montoDeCaja, montoDeCapital,
      creadoEn: new Date().toISOString()
    });
    alert(`✅ Gasto registrado: ${fmt(monto)}\n${iconFuente[fuenteDinero]}`);
    // Limpiar formulario
    ["gastoCategoria","gastoMonto","gastoDescripcion","gastoMontoCaja","gastoMontoCapital"].forEach(id => {
      const e = document.getElementById(id); if(e) e.value = "";
    });
    ["gastoMontoValue","gastoMontoCaja_gv","gastoMontoCapital_gpv"].forEach(id => {
      const e = document.getElementById(id); if(e) e.value = "";
    });
    document.querySelectorAll("input[name='gastoFuente']").forEach(r => r.checked = false);
    const bm = document.getElementById("gastoBloqueMixto"); if(bm) bm.style.display = "none";
    const fh = document.getElementById("gastoFuenteHint"); if(fh) fh.style.display = "block";
    document.getElementById("gastoFecha").value = hoy();
  } catch(e) { alert("❌ "+e.message); }
};

function renderGastos() {
  const container = document.getElementById("listaGastos"); if(!container) return;
  if (!gastosGlobal.length) { container.innerHTML='<p class="empty-txt">No hay gastos registrados.</p>'; return; }
  container.innerHTML = gastosGlobal.map(g => {
    const fuenteIcons = { caja:"💰 Caja (ventas)", capital:"💼 Capital propio", mixto:`🔀 Mixto (Caja: ${fmt(g.montoDeCaja||0)} · Capital: ${fmt(g.montoDeCapital||0)})` };
    const fuenteColors = { caja:"#1e8449", capital:"#1a5276", mixto:"#6c3483" };
    const fuenteHtml = g.fuenteDinero
      ? `<div class="reg-dato full-col"><div class="reg-dato-lbl">Fuente de dinero</div><div class="reg-dato-val" style="font-weight:700;color:${fuenteColors[g.fuenteDinero]||'#333'}">${fuenteIcons[g.fuenteDinero]||g.fuenteDinero}</div></div>`
      : `<div class="reg-dato full-col"><div class="reg-dato-lbl">Fuente de dinero</div><div class="reg-dato-val" style="color:#c0392b;font-size:0.82rem">⚠️ No registrada (gasto antiguo)</div></div>`;
    return `
    <div class="reg-card">
      <div class="reg-head gasto-h">
        <div class="reg-head-left">
          <h4>💸 ${g.categoria||"Gasto"}</h4>
          <p>${g.diaSemana||""}, ${g.fecha||""}</p>
        </div>
        <div class="reg-monto">${fmt(g.monto)}</div>
      </div>
      <div class="reg-body">
        ${g.descripcion?`<div class="reg-dato"><div class="reg-dato-lbl">Descripción</div><div class="reg-dato-val">${g.descripcion}</div></div>`:""}
        ${fuenteHtml}
      </div>
      ${esAdmin?`<div class="reg-actions"><button class="btn-rojo btn-sm" onclick="eliminarGasto('${g.id}')">🗑️ Eliminar</button></div>`:""}
    </div>`;
  }).join("");
}

window.eliminarGasto = async function(id) {
  if (!esAdmin||!confirm("⚠️ ¿Eliminar este gasto?")) return;
  await deleteDoc(doc(db,"Gastos",id));
};

// ===== INFORMES =====
window.generarInforme = function() {
  const desde = document.getElementById("informeDesde")?.value;
  const hasta = document.getElementById("informeHasta")?.value;
  if (!desde||!hasta) { alert("⚠️ Seleccione el rango de fechas"); return; }

  const ventas  = ventasGlobal.filter(v=>v.fecha>=desde&&v.fecha<=hasta);
  const compras = comprasGlobal.filter(c=>c.fecha>=desde&&c.fecha<=hasta);
  const gastos  = gastosGlobal.filter(g=>g.fecha>=desde&&g.fecha<=hasta);
  const cobros  = cobrosGlobal.filter(c=>c.fecha>=desde&&c.fecha<=hasta);

  const totVentas  = ventas.reduce((s,v)=>s+(v.total||0),0);
  const totCompras = compras.reduce((s,c)=>s+(c.costoTotal||0),0);
  const totGastos  = gastos.reduce((s,g)=>s+(g.monto||0),0);
  const totGanancia= totVentas - totCompras - totGastos;

  // Por producto
  const porProd = {};
  ventas.forEach(v=>{
    if(!porProd[v.productoNombre]) porProd[v.productoNombre]={ventas:0,ingresos:0,costo:0,ganancia:0,cantidad:0,esGranel:v.tipoStock==="granel"};
    porProd[v.productoNombre].ventas++;
    porProd[v.productoNombre].ingresos += v.total||0;
    porProd[v.productoNombre].cantidad += v.cantidad||0;
    // Contable: acumular costo y ganancia por venta
    if(v.tipoStock !== "granel"){
      porProd[v.productoNombre].costo    += v.costoVenta||0;
      porProd[v.productoNombre].ganancia += v.gananciaVenta||0;
    }
  });
  // Granel: restar lo que se pagó en compras del período a los ingresos
  compras.filter(c=>c.tipoCompra==="granel").forEach(c=>{
    if(porProd[c.productoNombre]){
      porProd[c.productoNombre].costo    += c.costoTotal||0;
      porProd[c.productoNombre].ganancia -= c.costoTotal||0;
    }
  });

  // Cobros pendientes
  const pendientes = cobrosGlobal.filter(c=>c.estado==="pendiente");
  const totPendiente = pendientes.reduce((s,c)=>s+(c.monto||0),0);

  const panel = document.getElementById("panelInforme");
  panel.style.display = "block";
  panel.innerHTML = `
    <div class="informe-seccion">
      <h3>📊 Resumen del Período: ${desde} al ${hasta}</h3>
      <div class="informe-resumen-grid">
        <div class="inf-res-box v"><div class="inf-res-lbl">Total Ventas</div><div class="inf-res-val">${fmt(totVentas)}</div></div>
        <div class="inf-res-box r"><div class="inf-res-lbl">Compras + Gastos</div><div class="inf-res-val">${fmt(totCompras+totGastos)}</div></div>
        <div class="inf-res-box ${totGanancia>=0?'a':'r'}"><div class="inf-res-lbl">Ganancia Neta</div><div class="inf-res-val">${fmt(totGanancia)}</div></div>
        <div class="inf-res-box n"><div class="inf-res-lbl">Cuentas Pendientes</div><div class="inf-res-val">${fmt(totPendiente)}</div></div>
      </div>
    </div>

    <div class="informe-seccion">
      <h3>📦 Ganancia por Producto</h3>
      <table class="informe-tabla">
        <tr><th>Producto</th><th>Ventas</th><th>Cantidad</th><th>Ingresos</th><th>Costo</th><th>Ganancia</th><th>% Margen</th></tr>
        ${Object.entries(porProd).sort((a,b)=>b[1].ganancia-a[1].ganancia).map(([nom,d])=>`
          <tr>
            <td><strong>${nom}</strong>${d.esGranel?' <span style="font-size:0.7rem;background:#fff3cd;color:#7c5e00;border-radius:3px;padding:1px 4px">granel</span>':''}</td>
            <td>${d.ventas}</td>
            <td>${d.cantidad.toFixed(2)}</td>
            <td>${fmt(d.ingresos)}</td>
            <td>${d.esGranel?'<span title="Compras del período">'+fmt(d.costo)+'</span>':fmt(d.costo)}</td>
            <td style="color:${d.ganancia>=0?'var(--verde)':'#e74c3c'};font-weight:800">${fmt(d.ganancia)}${d.esGranel&&d.ganancia<0?' ⚠️':''}</td>
            <td>${d.ingresos>0?((d.ganancia/d.ingresos)*100).toFixed(1):0}%</td>
          </tr>`).join("")}
        <tr class="total-row"><td><strong>TOTAL</strong></td><td>${ventas.length}</td><td>—</td><td>${fmt(totVentas)}</td><td>—</td><td>${fmt(totGanancia)}</td><td>—</td></tr>
      </table>
    </div>

    <div class="informe-seccion">
      <h3>💸 Gastos por Categoría</h3>
      <table class="informe-tabla">
        <tr><th>Categoría</th><th>Registros</th><th>Total</th></tr>
        ${Object.entries(gastos.reduce((acc,g)=>{acc[g.categoria]=(acc[g.categoria]||0)+g.monto;return acc},{}))
          .sort((a,b)=>b[1]-a[1])
          .map(([cat,tot])=>`<tr><td>${cat}</td><td>—</td><td>${fmt(tot)}</td></tr>`).join("")}
        <tr class="total-row"><td><strong>TOTAL GASTOS</strong></td><td>${gastos.length}</td><td>${fmt(totGastos)}</td></tr>
      </table>
    </div>

    <div class="informe-seccion">
      <h3>📋 Cuentas por Cobrar Pendientes</h3>
      <table class="informe-tabla">
        <tr><th>Cliente</th><th>Producto</th><th>Monto</th><th>Fecha pago</th><th>Estado</th>${esAdmin?"<th>Acción</th>":""}</tr>
        ${pendientes.length ? pendientes.map(c=>`
          <tr>
            <td>${c.cliente||"—"}</td>
            <td>${c.productoNombre||"—"}</td>
            <td>${fmt(c.monto)}</td>
            <td>${c.fechaPago||"—"}</td>
            <td><span class="pendiente-badge">PENDIENTE</span></td>
            ${esAdmin?`<td><button class="btn-verde btn-sm" onclick="marcarCobrado('${c.id}')">✅ Cobrado</button></td>`:""}
          </tr>`).join("") : '<tr><td colspan="6" style="text-align:center;color:#6b7c93">Sin cuentas pendientes</td></tr>'}
        ${pendientes.length?`<tr class="total-row"><td colspan="2"><strong>TOTAL PENDIENTE</strong></td><td>${fmt(totPendiente)}</td><td colspan="${esAdmin?3:2}">—</td></tr>`:""}
      </table>
    </div>
  `;
};

window.marcarCobrado = async function(id) {
  if (!confirm("¿Marcar como cobrado?")) return;
  await updateDoc(doc(db,"CuentasCobrar",id), { estado:"cobrado" });
  alert("✅ Marcado como cobrado");
  window.generarInforme();
};

// ===== MODALES =====
window.cerrarModal = function(id) { document.getElementById(id).style.display = "none"; };

// ===== UTILS =====
function setText(id,val) { const e=document.getElementById(id); if(e) e.textContent=val; }

// ===== INPUTS FORMATO =====
window.addEventListener("DOMContentLoaded", () => {
  aplicarFormateo("ventaPrecio", "ventaPrecioValue");
  aplicarFormateo("gastoMonto",  "gastoMontoValue");
  // Formateo precio unitario compra contable
  const cuInp = document.getElementById("compraCostoUnitarioInput");
  if (cuInp) {
    cuInp.addEventListener("input", function() {
      const n = parseMonto(this.value);
      this.value = n ? n.toLocaleString("es-CO") : "";
      calcularCostoUnitario();
    });
  }
  document.getElementById("ventaPrecio")?.addEventListener("input", calcularTotalVenta);
  document.getElementById("ventaCantidad")?.addEventListener("input", calcularTotalVenta);
});

export { db, auth, ventasGlobal, comprasGlobal, gastosGlobal, productosGlobal, cobrosGlobal };