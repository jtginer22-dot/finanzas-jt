/**
 * ============================================================
 * FINANZAS JT — Google Apps Script
 * ============================================================
 * INSTALACIÓN:
 * 1. Abre tu Google Sheet
 * 2. Menú: Extensiones → Apps Script
 * 3. Borra el contenido y pega TODO este código
 * 4. Edita las constantes de CONFIG (abajo)
 * 5. Menú: Ejecutar → inicializar (primera vez)
 * 6. Menú: Activadores → Agregar activador:
 *    - scanearGmail → cada 1 hora
 *    - enviarResumenDiario → cada día, 8:00-9:00 AM
 * ============================================================
 */

// ============================================================
// CONFIG — EDITAR AQUÍ
// ============================================================
const CONFIG = {
  EMAIL_DESTINO: 'jtginer22@gmail.com',
  APP_URL: 'https://TU-APP.netlify.app',  // Actualizar con tu URL de Netlify
  TIMEZONE: 'America/Santiago',
};

const SHEETS = {
  GASTOS: 'Gastos',
  PENDIENTES: 'Pendientes',
  CUENTAS: 'Cuentas_Por_Cobrar',
  CATEGORIAS: 'Categorias',
  METRICAS: 'Metricas_Mensuales',
};

// ============================================================
// INICIALIZAR — Crear estructura de pestañas
// ============================================================
function inicializar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Crear pestañas si no existen
  const tabs = {
    [SHEETS.GASTOS]: ['ID','Fecha','Descripción','Categoría','Etiqueta','Monto','Tarjeta','Tipo','Fuente','Banco','Notas'],
    [SHEETS.PENDIENTES]: ['ID','Fecha','Comercio','Monto','Tarjeta','Banco','Email_ID','Procesado'],
    [SHEETS.CUENTAS]: ['ID','Tipo','Persona','Monto','Fecha_Creacion','Fecha_Limite','Estado','Descripción'],
    [SHEETS.CATEGORIAS]: ['ID','Nombre','Color','Tipo','Activa'],
    [SHEETS.METRICAS]: ['Mes','Total_Gastos','Total_Fijos','Total_Variables','Total_Extraordinarios','N_Transacciones','Por_Cobrar','Por_Pagar'],
  };
  
  Object.entries(tabs).forEach(([nombre, headers]) => {
    let sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      sheet = ss.insertSheet(nombre);
      Logger.log(`Pestaña creada: ${nombre}`);
    }
    // Escribir headers si la hoja está vacía
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  
  // Cargar categorías iniciales
  const catSheet = ss.getSheetByName(SHEETS.CATEGORIAS);
  if (catSheet.getLastRow() <= 1) {
    const cats = [
      ['c1','Crédito consumo','gris','fijo','SI'],
      ['c2','Suscripciones','morado','fijo','SI'],
      ['c3','Tenis','verde','fijo','SI'],
      ['c4','Vivienda','azul','variable','SI'],
      ['c5','Supermercado','verde','variable','SI'],
      ['c6','Restaurantes','ambar','variable','SI'],
      ['c7','Transporte','azul','variable','SI'],
      ['c8','Entretenimiento','morado','variable','SI'],
      ['c9','Ropa y personal','rosa','variable','SI'],
      ['c10','Salud','rojo','variable','SI'],
      ['c11','Regalos','rosa','variable','SI'],
      ['c12','Gastos compartidos','verde','variable','SI'],
      ['c13','Otros','gris','variable','SI'],
      ['c14','Auto','ambar','extraordinario','SI'],
      ['c15','eBike','verde','extraordinario','SI'],
      ['c16','Viajes','azul','extraordinario','SI'],
    ];
    catSheet.getRange(2, 1, cats.length, 5).setValues(cats);
  }
  
  Logger.log('✅ Inicialización completa');
  SpreadsheetApp.getUi().alert('✅ Estructura creada correctamente. Ahora configura los activadores.');
}

// ============================================================
// SCANNER GMAIL — Corre cada 1 hora
// ============================================================
function scanearGmail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  
  // IDs ya procesados
  const procesados = new Set();
  if (pendSheet.getLastRow() > 1) {
    const ids = pendSheet.getRange(2, 7, pendSheet.getLastRow()-1, 1).getValues().flat();
    ids.forEach(id => procesados.add(id));
  }
  
  let nuevos = 0;
  
  // ---- BANCO DE CHILE ----
  const hilosBCI = GmailApp.search('from:enviodigital@bancochile.cl subject:"Compra con Tarjeta de Crédito" newer_than:7d', 0, 20);
  hilosBCI.forEach(hilo => {
    const msgs = hilo.getMessages();
    msgs.forEach(msg => {
      const msgId = msg.getId();
      if (procesados.has(msgId)) return;
      
      const cuerpo = msg.getPlainBody() || msg.getBody();
      const fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
      
      // Parser BCI: "compra por $28.140 con Tarjeta de Crédito ****7076 en BRUNAPOLI LOS DOMINICOS"
      const montoMatch = cuerpo.match(/compra por \$([0-9.,]+)/i);
      const comercioMatch = cuerpo.match(/en ([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?) el \d/i);
      const tarjetaMatch = cuerpo.match(/\*{4}(\d{4})/);
      
      if (!montoMatch) return;
      
      const monto = parseFloat(montoMatch[1].replace(/\./g,'').replace(',','.'));
      const comercio = comercioMatch ? comercioMatch[1].trim() : msg.getSubject();
      const tarjeta = tarjetaMatch ? `TC BCI ****${tarjetaMatch[1]}` : 'TC Banco de Chile';
      
      const uid = Utilities.getUuid().slice(0,8);
      pendSheet.appendRow([uid, fecha, comercio, monto, tarjeta, 'Banco de Chile', msgId, 'NO']);
      nuevos++;
      Logger.log(`BCI detectado: ${comercio} $${monto}`);
    });
  });
  
  // ---- SANTANDER — Transferencias ----
  const hilosSant = GmailApp.search('from:mensajeria@santander.cl subject:"Comprobante Transferencia" newer_than:7d', 0, 20);
  hilosSant.forEach(hilo => {
    const msgs = hilo.getMessages();
    msgs.forEach(msg => {
      const msgId = msg.getId();
      if (procesados.has(msgId)) return;
      
      const cuerpo = msg.getPlainBody() || msg.getBody();
      const fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
      
      // Parser Santander transferencia
      const montoMatch = cuerpo.match(/Monto transferido\s*\$\s*([\d.,]+)/i);
      const destMatch = cuerpo.match(/Nombre\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-Z\s]+)\s+RUT/);
      
      if (!montoMatch) return;
      
      const monto = parseFloat(montoMatch[1].replace(/\./g,'').replace(',','.'));
      const dest = destMatch ? destMatch[1].trim() : 'Destinatario';
      const comercio = `Transferencia a ${dest}`;
      
      const uid = Utilities.getUuid().slice(0,8);
      pendSheet.appendRow([uid, fecha, comercio, monto, 'Transferencia Santander', 'Santander', msgId, 'NO']);
      nuevos++;
      Logger.log(`Santander detectado: ${comercio} $${monto}`);
    });
  });
  
  // ---- SANTANDER — Compras TC (cuando estén activas) ----
  // Activar cuando llegue el primer email de notificación TC Santander
  // const hilosSantTC = GmailApp.search('from:mensajeria@santander.cl subject:"Compra" newer_than:7d', 0, 20);
  // Agregar parser aquí una vez que tengamos el formato del email
  
  Logger.log(`Scanner completo: ${nuevos} nuevos gastos detectados`);
  
  // Si hay nuevos, enviar notificación inmediata
  if (nuevos > 0) {
    enviarNotificacionNuevos(nuevos);
  }
}

// ============================================================
// NOTIFICACIÓN INMEDIATA cuando llegan gastos nuevos
// ============================================================
function enviarNotificacionNuevos(n) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  const pendientes = pendSheet.getLastRow() > 1 
    ? pendSheet.getRange(2, 1, pendSheet.getLastRow()-1, 8).getValues().filter(r => r[7] === 'NO')
    : [];
  
  if (!pendientes.length) return;
  
  const itemsHtml = pendientes.map(r => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 12px;font-weight:600;color:#111">${r[2]}</td>
      <td style="padding:10px 12px;font-family:monospace;color:#EF4444;font-weight:700">${formatMonto(r[3])}</td>
      <td style="padding:10px 12px;color:#6B7280;font-size:12px">${r[1]}</td>
      <td style="padding:10px 12px;color:#6B7280;font-size:12px">${r[5]}</td>
    </tr>
  `).join('');
  
  const html = `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#F9FAFB">
  <div style="max-width:540px;margin:0 auto;padding:20px">
    <div style="background:#111827;border-radius:14px;padding:20px 24px;margin-bottom:16px">
      <div style="font-size:22px;margin-bottom:4px">💰</div>
      <div style="color:#10B981;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">Finanzas JT</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-top:4px">${pendientes.length} gasto${pendientes.length>1?'s':''} nuevo${pendientes.length>1?'s':''} detectado${pendientes.length>1?'s':''}</div>
    </div>
    
    <div style="background:#fff;border-radius:14px;border:1px solid #E5E7EB;overflow:hidden;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F9FAFB">
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Descripción</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Monto</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Fecha</th>
            <th style="padding:10px 12px;text-align:left;font-size:10px;color:#9CA3AF;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Banco</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
    
    <a href="${CONFIG.APP_URL}?action=pendientes" 
       style="display:block;background:#10B981;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px">
      Categorizar ahora →
    </a>
    
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:16px">Finanzas JT · Sistema automático</p>
  </div>
</body>
</html>`;
  
  GmailApp.sendEmail(
    CONFIG.EMAIL_DESTINO,
    `💰 ${pendientes.length} gasto${pendientes.length>1?'s':''} nuevo${pendientes.length>1?'s':''} — Finanzas JT`,
    `Tienes ${pendientes.length} gasto(s) nuevo(s) para categorizar. Abre la app: ${CONFIG.APP_URL}?action=pendientes`,
    { htmlBody: html, name: 'Finanzas JT' }
  );
  Logger.log(`Notificación enviada: ${pendientes.length} nuevos gastos`);
}

// ============================================================
// EMAIL DIARIO — Corre cada mañana a las 8:00 AM
// ============================================================
function enviarResumenDiario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  const gastoSheet = ss.getSheetByName(SHEETS.GASTOS);
  const cuentaSheet = ss.getSheetByName(SHEETS.CUENTAS);
  
  // Pendientes sin categorizar
  const pendientes = pendSheet.getLastRow() > 1
    ? pendSheet.getRange(2,1,pendSheet.getLastRow()-1,8).getValues().filter(r=>r[7]==='NO')
    : [];
  
  // Gastos de este mes
  const hoy = new Date();
  const mesActual = Utilities.formatDate(hoy, CONFIG.TIMEZONE, 'yyyy-MM');
  const gastos = gastoSheet.getLastRow() > 1
    ? gastoSheet.getRange(2,1,gastoSheet.getLastRow()-1,11).getValues().filter(r=>String(r[1]).startsWith(mesActual))
    : [];
  const totalMes = gastos.reduce((a,r)=>a+parseFloat(r[5]||0),0);
  
  // Cuentas por cobrar activas
  const cuentas = cuentaSheet.getLastRow() > 1
    ? cuentaSheet.getRange(2,1,cuentaSheet.getLastRow()-1,8).getValues().filter(r=>r[1]==='cobrar'&&r[6]!=='pagado')
    : [];
  const totalCobrar = cuentas.reduce((a,r)=>a+parseFloat(r[3]||0),0);
  
  // Alertas de cobros vencidos (+7 días)
  const alertas = cuentas.filter(r => {
    if (!r[4]) return false;
    const dias = (hoy - new Date(r[4])) / 86400000;
    return dias > 7;
  });
  
  // Si no hay nada nuevo, no enviar
  if (pendientes.length===0 && alertas.length===0) {
    Logger.log('Sin novedades, no se envía email diario');
    return;
  }
  
  // Construir email
  let pendHtml = '';
  if (pendientes.length > 0) {
    pendHtml = `
    <div style="background:#fff;border-radius:14px;border:1px solid #E5E7EB;overflow:hidden;margin-bottom:16px">
      <div style="padding:12px 16px;border-bottom:1px solid #F3F4F6;display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:700;color:#111">🔔 Sin categorizar</div>
        <div style="background:#FEF3C7;color:#78350F;border-radius:8px;padding:3px 10px;font-size:12px;font-weight:600">${pendientes.length} pendientes</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${pendientes.map(r=>`<tr style="border-bottom:1px solid #F9FAFB">
          <td style="padding:9px 16px;font-weight:500;color:#111;font-size:13px">${r[2]}</td>
          <td style="padding:9px 16px;font-family:monospace;color:#EF4444;font-weight:700;font-size:14px">${formatMonto(r[3])}</td>
          <td style="padding:9px 16px;color:#9CA3AF;font-size:11px">${r[5]}</td>
        </tr>`).join('')}
      </table>
    </div>`;
  }
  
  let alertasHtml = '';
  if (alertas.length > 0) {
    alertasHtml = `
    <div style="background:#FEE2E2;border-radius:14px;padding:14px 16px;margin-bottom:16px">
      <div style="font-weight:700;color:#7F1D1D;margin-bottom:8px">⚠️ Cobros vencidos</div>
      ${alertas.map(r=>{
        const dias=Math.floor((hoy-new Date(r[4]))/86400000);
        return`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
          <span style="color:#7F1D1D;font-size:13px">${r[2]} · <em>hace ${dias} días</em></span>
          <span style="font-family:monospace;font-weight:700;color:#7F1D1D">${formatMonto(r[3])}</span>
        </div>`;}).join('')}
    </div>`;
  }
  
  const html = `
<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#F9FAFB">
  <div style="max-width:540px;margin:0 auto;padding:20px">
    <div style="background:#111827;border-radius:14px;padding:20px 24px;margin-bottom:16px">
      <div style="font-size:22px;margin-bottom:6px">💰</div>
      <div style="color:#10B981;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">Finanzas JT · Resumen diario</div>
      <div style="color:#fff;font-size:22px;font-weight:700;margin-top:6px">${Utilities.formatDate(hoy,CONFIG.TIMEZONE,'EEEE d MMMM')}</div>
    </div>
    
    <div style="display:grid;gap:10px;margin-bottom:16px">
      <div style="background:#D1FAE5;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;font-weight:600;color:#065F46;text-transform:uppercase;letter-spacing:.06em">Gastos del mes</div>
        <div style="font-family:monospace;font-size:20px;font-weight:800;color:#065F46">${formatMonto(totalMes)}</div>
      </div>
      <div style="background:#DBEAFE;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;font-weight:600;color:#1E3A8A;text-transform:uppercase;letter-spacing:.06em">Por cobrar</div>
        <div style="font-family:monospace;font-size:20px;font-weight:800;color:#1E3A8A">${formatMonto(totalCobrar)}</div>
      </div>
    </div>
    
    ${pendHtml}
    ${alertasHtml}
    
    <a href="${CONFIG.APP_URL}?action=pendientes" 
       style="display:block;background:#10B981;color:#fff;text-decoration:none;text-align:center;padding:15px;border-radius:12px;font-weight:800;font-size:16px;letter-spacing:-.01em">
      Abrir app →
    </a>
    
    <p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px">Finanzas JT · Solo lectura de notificaciones bancarias</p>
  </div>
</body>
</html>`;
  
  const mesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][hoy.getMonth()];
  GmailApp.sendEmail(
    CONFIG.EMAIL_DESTINO,
    `💰 ${pendientes.length>0?pendientes.length+' por categorizar · ':''}${mesNombre}: ${formatMonto(totalMes)} — Finanzas JT`,
    `Resumen diario Finanzas JT. Abre la app: ${CONFIG.APP_URL}`,
    { htmlBody: html, name: 'Finanzas JT' }
  );
  Logger.log('Email diario enviado');
}

// ============================================================
// HELPERS
// ============================================================
function formatMonto(n) {
  return '$' + Math.round(Number(n)||0).toLocaleString('es-CL');
}

// Para marcar un pendiente como procesado (llamar desde la app)
function marcarProcesado(emailId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.PENDIENTES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][6] === emailId) {
      sheet.getRange(i+1, 8).setValue('SI');
      break;
    }
  }
}

// Test manual — ejecutar para verificar que el script funciona
function testManual() {
  Logger.log('=== TEST MANUAL ===');
  Logger.log('Sheet ID: ' + SpreadsheetApp.getActiveSpreadsheet().getId());
  Logger.log('Email destino: ' + CONFIG.EMAIL_DESTINO);
  Logger.log('App URL: ' + CONFIG.APP_URL);
  scanearGmail();
  Logger.log('=== FIN TEST ===');
}
