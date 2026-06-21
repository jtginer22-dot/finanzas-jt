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
  APP_URL: 'https://finanzas-jt.netlify.app',  // URL de Netlify — actualizar si cambia
  TIMEZONE: 'America/Santiago',
};

const SHEETS = {
  GASTOS: 'Gastos',
  PENDIENTES: 'Pendientes',
  CUENTAS: 'Cuentas_Por_Cobrar',
  CATEGORIAS: 'Categorias',
  METRICAS: 'Metricas_Mensuales',
  PRESUPUESTOS: 'Presupuestos',
  INGRESOS: 'Ingresos',
  INVERSIONES: 'Inversiones',
  CONCILIACION: 'Conciliacion_Mensual',
  COMPARTIDOS: 'Compartidos',
};

// ============================================================
// INICIALIZAR — Crear estructura de pestañas
// ============================================================
function inicializar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Crear pestañas si no existen
  const tabs = {
    [SHEETS.GASTOS]: ['ID','Fecha','Descripción','Categoría','Etiqueta','Monto','Tarjeta','Tipo','Fuente','Banco','Notas','Monto_Total','Recurrente','Recurrente_Hasta','Recurrente_Frecuencia'],
    [SHEETS.COMPARTIDOS]: ['ID','Fecha','Descripcion','Total','Categoria','Metodo','Personas_JSON','Gasto_ID'],
    [SHEETS.PENDIENTES]: ['ID','Fecha','Comercio','Monto','Tarjeta','Banco','Email_ID','Procesado'],
    [SHEETS.CUENTAS]: ['ID','Tipo','Persona','Monto','Fecha_Creacion','Fecha_Limite','Estado','Descripción'],
    [SHEETS.CATEGORIAS]: ['ID','Nombre','Color','Tipo','Activa'],
    [SHEETS.METRICAS]: ['Mes','Total_Gastos','Total_Fijos','Total_Variables','Total_Extraordinarios','N_Transacciones','Por_Cobrar','Por_Pagar'],
    [SHEETS.PRESUPUESTOS]: ['Categoria','Monto_Mensual'],
    [SHEETS.INGRESOS]: ['ID','Fecha','Fuente','Monto','Notas'],
    [SHEETS.INVERSIONES]: ['ID','Fecha','Instrumento','Monto_Invertido','Valor_Actual','Notas','Cantidad','Ticker'],
    [SHEETS.CONCILIACION]: ['ID','Mes','Banco','Total_Cartola','Total_App','Diferencia','Notas'],
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

/** Monto en pesos chilenos desde cuerpo de correo Banco de Chile (enviodigital@bancochile.cl): compras, Apple Pay, etc. */
function parseMontoDesdeCorreoBancoDeChile_(cuerpo) {
  if (!cuerpo) return null;
  const patterns = [
    /compra por\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/i,
    /compra por\s*\$?\s*([0-9]+(?:,[0-9]+)?)/i,
    /monto\s*(?:de\s*)?(?:la\s*)?(?:compra\s*)?[:\s]*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = cuerpo.match(patterns[i]);
    if (m && m[1]) {
      var n = parseFloat(String(m[1]).replace(/\./g, '').replace(',', '.'));
      if (n > 0) return n;
    }
  }
  return null;
}

/** Monto de compra TC Santander (evita cupo/deuda; varios formatos de correo y notif push). */
function parseMontoDesdeCorreoSantanderTC_(cuerpo) {
  if (!cuerpo) return null;
  var amounts = [];
  var patterns = [
    /compra\s+por\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/gi,
    /cargo\s+por\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/gi,
    /consumo\s+de\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/gi,
    /monto\s*(?:de\s*)?(?:la\s*)?(?:compra\s*)?[:\s]*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)/gi,
    /por\s*\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?)\s+en\s/gi,
    // Captura directa de monto "$XX.XXX" o "$ XX.XXX" — notificaciones push Santander
    /\$\s*([0-9]{1,3}(?:\.[0-9]{3})+)/g,
  ];
  for (var pi = 0; pi < patterns.length; pi++) {
    var re = patterns[pi];
    var m;
    while ((m = re.exec(cuerpo)) !== null) {
      if (m[1]) {
        var n = parseFloat(String(m[1]).replace(/\./g, '').replace(',', '.'));
        if (n > 0 && n < 50000000) amounts.push(n);
      }
    }
  }
  if (!amounts.length) return null;
  amounts.sort(function (a, b) { return a - b; });
  while (amounts.length > 1) {
    var max = amounts[amounts.length - 1];
    var med = amounts[Math.floor(amounts.length / 2)];
    if (max > Math.max(med * 8, 800000) && max > 1000000) amounts.pop();
    else break;
  }
  return amounts[0];
}

/**
 * ventanaHoras: ventana de búsqueda en Gmail.
 * - Trigger automático (cada 10 min) llama sin parámetros → usa 1 hora.
 * - testManual() llama con ventanaHoras=168 para escanear 7 días.
 * Limitar la ventana evita el timeout de 6 min en Apps Script.
 */
function scanearGmail(ventanaHoras) {
  ventanaHoras = ventanaHoras || 1;
  // Convertir horas a token Gmail newer_than
  var ventana;
  if (ventanaHoras <= 6)        ventana = '6h';
  else if (ventanaHoras <= 24)  ventana = '1d';
  else if (ventanaHoras <= 48)  ventana = '2d';
  else if (ventanaHoras <= 96)  ventana = '4d';
  else                          ventana = '7d';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);

  // IDs ya procesados
  const procesados = new Set();
  if (pendSheet.getLastRow() > 1) {
    const numRows = pendSheet.getLastRow() - 1;
    const ids = pendSheet.getRange(2, 7, numRows, 1).getValues().flat();
    ids.forEach(id => procesados.add(id));
  }

  let nuevos = 0;

  // ---- BANCO DE CHILE (TC + Apple Pay y variantes de texto) ----
  const queriesBancoDeChile = [
    'from:enviodigital@bancochile.cl subject:"Compra con Tarjeta de Crédito" newer_than:' + ventana,
    'from:enviodigital@bancochile.cl ("Apple Pay" OR "APPLE PAY") newer_than:' + ventana,
    'from:enviodigital@bancochile.cl (compra OR cargo) (tarjeta OR crédito) newer_than:' + ventana,
  ];
  const seenMsg = new Set();
  queriesBancoDeChile.forEach(function (q) {
    const hilosBdC = GmailApp.search(q, 0, 15);
    hilosBdC.forEach(function (hilo) {
      const msgs = hilo.getMessages();
      msgs.forEach(function (msg) {
        const msgId = msg.getId();
        if (seenMsg.has(msgId) || procesados.has(msgId)) return;
        seenMsg.add(msgId);

        const cuerpo = msg.getPlainBody() || msg.getBody();
        const fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');

        const monto = parseMontoDesdeCorreoBancoDeChile_(cuerpo);
        if (monto === null || monto <= 0) return;

        const comercioMatch = cuerpo.match(/en ([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s\.\-]+?) el \d/i);
        var comercio = comercioMatch ? comercioMatch[1].trim() : msg.getSubject();
        if (/apple\s*pay/i.test(cuerpo) || /apple\s*pay/i.test(msg.getSubject())) {
          comercio = 'Apple Pay · ' + comercio;
        }

        const tarjetaMatch = cuerpo.match(/\*{4}(\d{4})/);
        const tarjeta = tarjetaMatch ? ('TC Banco de Chile ****' + tarjetaMatch[1]) : 'TC Banco de Chile';

        const uid = Utilities.getUuid().slice(0, 8);
        pendSheet.appendRow([uid, fecha, comercio, monto, tarjeta, 'Banco de Chile', msgId, 'NO']);
        nuevos++;
        Logger.log('Banco de Chile (correo): ' + comercio + ' $' + monto);
      });
    });
  });

  // ---- SANTANDER — Transferencias ----
  const hilosSant = GmailApp.search('from:mensajeria@santander.cl subject:"Comprobante Transferencia" newer_than:' + ventana, 0, 20);
  hilosSant.forEach(hilo => {
    const msgs = hilo.getMessages();
    msgs.forEach(msg => {
      const msgId = msg.getId();
      if (seenMsg.has(msgId) || procesados.has(msgId)) return;
      seenMsg.add(msgId);

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

  // ---- SANTANDER — Compras TC (notificación email; suscripciones, comercio físico, etc.) ----
  var queriesSantTC = [
    'from:mensajeria@santander.cl (compra OR cargo OR consumo) (tarjeta OR crédito OR credito) newer_than:' + ventana,
    'from:mensajeria@santander.cl subject:(Compra OR Cargo OR "Tarjeta de Crédito") newer_than:' + ventana,
  ];
  queriesSantTC.forEach(function (q) {
    var hilosSantTC = GmailApp.search(q, 0, 20);
    hilosSantTC.forEach(function (hilo) {
      var msgs = hilo.getMessages();
      msgs.forEach(function (msg) {
        var msgId = msg.getId();
        if (seenMsg.has(msgId) || procesados.has(msgId)) return;
        seenMsg.add(msgId);

        var cuerpo = msg.getPlainBody() || msg.getBody();
        var monto = parseMontoDesdeCorreoSantanderTC_(cuerpo);
        if (monto === null || monto <= 0) return;

        var fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
        var comercio = msg.getSubject();
        var comMatch = cuerpo.match(/en\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s\.\-\*]+?)\s+el\s+\d/i);
        if (comMatch) comercio = comMatch[1].trim();
        else {
          var subM = msg.getSubject().match(/compra\s+en\s+(.+)/i);
          if (subM) comercio = subM[1].trim();
        }

        var tarjetaMatch = cuerpo.match(/\*{4}(\d{4})/);
        var tarjeta = tarjetaMatch ? ('TC Santander ****' + tarjetaMatch[1]) : 'TC Santander';

        var uidTc = Utilities.getUuid().slice(0, 8);
        pendSheet.appendRow([uidTc, fecha, comercio, monto, tarjeta, 'Santander', msgId, 'NO']);
        nuevos++;
        Logger.log('Santander TC (correo): ' + comercio + ' $' + monto);
      });
    });
  });

  // ---- SCREENSHOTS enviados por el usuario a sí mismo ----
  nuevos += scanearScreenshotsEmail_(pendSheet, procesados, seenMsg, ventana);

  // ---- ESTADO DE CUENTA / CARTOLA SANTANDER (PDF encriptado) ----
  // Se desencripta automáticamente via Netlify extract-pdf usando el RUT
  // guardado en Script Properties. Solo hace trabajo cuando llega un email nuevo.
  nuevos += scanearEstadoCuentaSantander_(pendSheet, procesados, seenMsg);

  Logger.log(`Scanner completo: ${nuevos} nuevos gastos detectados`);
  
  // Si hay nuevos, enviar notificación inmediata
  if (nuevos > 0) {
    enviarNotificacionNuevos(nuevos);
  }
}

// ============================================================
// SCANNER SCREENSHOTS — el usuario manda captura por email a sí mismo
// ============================================================

/**
 * Detecta emails del propio usuario con asunto que incluya "gasto", "💳" o "santander",
 * extrae el texto de la imagen adjunta usando OCR de Google Drive, parsea el monto
 * y lo agrega a Pendientes.
 *
 * PREREQUISITO EN APPS SCRIPT: habilitar "Drive API" en Servicios (ícono +) → Drive API.
 * INSTRUCCIÓN DE USO: saca captura de la notif Santander → comparte → Mail → asunto "💳"
 */
function scanearScreenshotsEmail_(pendSheet, procesados, seenMsg, ventana) {
  ventana = ventana || '3d';
  // Excluye nuestros propios correos de notificación (que también son from:email y contienen "gasto").
  // El "-subject:nuevo" los descarta. Sin has:attachment para capturar también imágenes inline.
  const q = 'from:' + CONFIG.EMAIL_DESTINO + ' (subject:gasto OR subject:💳 OR subject:santander OR subject:captura OR subject:compra) -subject:nuevo newer_than:' + ventana;
  var nuevos = 0;
  try {
    var hilos = GmailApp.search(q, 0, 10);
    Logger.log('scanearScreenshots: hilos encontrados=' + hilos.length + ' (query ventana=' + ventana + ')');
    hilos.forEach(function(hilo) {
      hilo.getMessages().forEach(function(msg) {
        var msgId = msg.getId();
        var asunto = msg.getSubject();
        Logger.log('  Email: "' + asunto + '" | ID=' + msgId);
        if (seenMsg.has(msgId)) { Logger.log('    → ya procesado en esta sesión'); return; }
        if (procesados.has(msgId)) { Logger.log('    → ya en Pendientes'); return; }
        seenMsg.add(msgId);

        // IMPORTANTE: includeInlineImages:true captura imágenes pegadas en el cuerpo
        // (como las capturas de pantalla que iOS envía al compartir la notif).
        var attachments = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
        Logger.log('    Adjuntos (incluyendo inline): ' + attachments.length);

        attachments.forEach(function(att, ai) {
          var tipo = att.getContentType();
          Logger.log('    [' + ai + '] tipo=' + tipo + ' nombre=' + att.getName());
          if (!tipo.startsWith('image/')) {
            Logger.log('      → no es imagen, se salta');
            return;
          }

          try {
            // OCR nativo vía Drive API v2 (requiere servicio Drive habilitado, versión v2)
            var blob = att.copyBlob();
            var file = Drive.Files.insert(
              { title: 'ocr_finanzas_temp', mimeType: blob.getContentType() },
              blob,
              { ocr: true, ocrLanguage: 'es' }
            );
            var doc = DocumentApp.openById(file.id);
            var texto = doc.getBody().getText();
            DriveApp.getFileById(file.id).setTrashed(true);
            Utilities.sleep(2000);

            if (!texto || texto.length < 5) {
              Logger.log('      ⚠️ OCR no extrajo texto');
              return;
            }
            Logger.log('      OCR OK (' + texto.length + ' chars): "' + texto.slice(0, 200) + '"');

            // Extraer TODAS las transacciones del screenshot (puede haber varias)
            var fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
            var transacciones = extraerTransaccionesDeTextoOCR_(texto);
            Logger.log('      Transacciones encontradas: ' + transacciones.length);

            if (!transacciones.length) {
              Logger.log('      ⚠️ No se encontraron montos en el OCR');
              return;
            }

            transacciones.forEach(function(t) {
              // 1. Pendiente monto=0 → rellenar
              var matchRow = buscarPendienteCeroSantander_(pendSheet, t.comercio, fecha);
              if (matchRow > 0) {
                pendSheet.getRange(matchRow, 4).setValue(t.monto);
                Logger.log('      ✅ Monto rellenado fila ' + matchRow + ': ' + t.comercio + ' $' + t.monto);
                nuevos++;
                return;
              }
              // 2. Ya existe con monto → no duplicar
              if (existeTransaccionDuplicada_(pendSheet, t.comercio, t.monto, fecha)) {
                Logger.log('      ⏭ Ya existe: ' + t.comercio + ' $' + t.monto);
                return;
              }
              // 3. Nueva transacción
              var uid = Utilities.getUuid().slice(0, 8);
              pendSheet.appendRow([uid, fecha, t.comercio, t.monto, 'TC Santander', 'Santander', msgId + '_' + uid, 'NO']);
              Logger.log('      ➕ Nueva: ' + t.comercio + ' $' + t.monto);
              nuevos++;
            });
          } catch (ocrErr) {
            Logger.log('      ❌ Error OCR: ' + ocrErr.message);
          }
        });
      });
    });
  } catch (e) {
    Logger.log('scanearScreenshotsEmail error: ' + e.message);
  }
  Logger.log('scanearScreenshots: nuevos=' + nuevos);
  return nuevos;
}

// ============================================================
// NOTIFICACIÓN INMEDIATA cuando llegan gastos nuevos
// ============================================================
function enviarNotificacionNuevos(n) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  const pendNumRows = Math.max(0, pendSheet.getLastRow() - 1);
  const pendientes = pendNumRows > 0
    ? pendSheet.getRange(2, 1, pendNumRows, 8).getValues().filter(r => r[7] === 'NO')
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
  const pendNumRows2 = Math.max(0, pendSheet.getLastRow() - 1);
  const pendientes = pendNumRows2 > 0
    ? pendSheet.getRange(2, 1, pendNumRows2, 8).getValues().filter(r => r[7] === 'NO')
    : [];

  // Gastos de este mes
  const hoy = new Date();
  const mesActual = Utilities.formatDate(hoy, CONFIG.TIMEZONE, 'yyyy-MM');
  const gastoNumRows = Math.max(0, gastoSheet.getLastRow() - 1);
  const gastos = gastoNumRows > 0
    ? gastoSheet.getRange(2, 1, gastoNumRows, 11).getValues().filter(r => String(r[1]).startsWith(mesActual))
    : [];
  const totalMes = gastos.reduce((a,r)=>a+parseFloat(r[5]||0),0);
  
  // Cuentas por cobrar activas
  const cuentaNumRows = Math.max(0, cuentaSheet.getLastRow() - 1);
  const cuentas = cuentaNumRows > 0
    ? cuentaSheet.getRange(2, 1, cuentaNumRows, 8).getValues().filter(r => r[1] === 'cobrar' && r[6] !== 'pagado')
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

/**
 * Extrae TODAS las transacciones (comercio + monto) de un texto OCR.
 * Funciona con screenshots de una o varias notificaciones apiladas,
 * la app Wallet, la app Santander, o cualquier texto con montos $X.XXX.
 *
 * Estrategia: busca cada ocurrencia de $X.XXX en el texto y asocia
 * el texto más cercano no-genérico como nombre de comercio.
 */
function extraerTransaccionesDeTextoOCR_(texto) {
  if (!texto) return [];
  var lineas = texto.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(Boolean);
  var resultado = [];
  var vistosKey = {};

  // Palabras genéricas que NO son nombres de comercio
  var generico = /^(santander|banco|wallet|apple\s*pay|visa|mastercard|redcompra|hoy|ayer|hace\s+\d|transacci[oó]n|compra|cargo|consumo|notificaci[oó]n|\d{1,2}[\s\/]\w+|\d{2}:\d{2}|jun|jul|ago|sep|oct|nov|dic|ene|feb|mar|abr|may|chile)/i;

  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];

    // Buscar monto en esta línea: $X.XXX (formato chileno con puntos)
    var montoM = linea.match(/\$\s*([0-9]{1,3}(?:\.[0-9]{3})+)/);
    if (!montoM) continue;

    var monto = parseFloat(montoM[1].replace(/\./g, ''));
    if (!monto || monto <= 0 || monto > 50000000) continue;

    var comercio = null;

    // 1. Mismo línea: "Transacción por $X en COMERCIO" o "en COMERCIO $X"
    var inline = linea.match(/(?:en\s+)([A-ZÁÉÍÓÚÑ0-9][^\n\r$]{2,50}?)(?:\s*\$|\s+[-—]|\s*$)/i);
    if (inline && inline[1].trim().length >= 3 && !generico.test(inline[1].trim())) {
      comercio = inline[1].trim();
    }

    // 2. Líneas anteriores (hasta 3 atrás): buscar la primera no-genérica
    if (!comercio) {
      for (var j = i - 1; j >= Math.max(0, i - 3); j--) {
        var prev = lineas[j];
        if (generico.test(prev)) continue;
        if (/^\$/.test(prev)) continue;       // otra línea de monto
        if (prev.length < 3) continue;
        if (/^\d+$/.test(prev)) continue;     // solo números
        comercio = prev.slice(0, 60);
        break;
      }
    }

    // 3. Línea siguiente (a veces el comercio viene después del monto)
    if (!comercio && i + 1 < lineas.length) {
      var next = lineas[i + 1];
      if (!generico.test(next) && !/^\$/.test(next) && next.length >= 3 && !/^\d+$/.test(next)) {
        comercio = next.slice(0, 60);
      }
    }

    if (!comercio) comercio = 'Santander (captura)';
    comercio = comercio.replace(/^[-•·]\s*/, '').trim();

    // Deduplicar por (monto, comercio normalizado)
    var normKey = monto + '|' + comercio.toUpperCase().replace(/\s+/g, '').slice(0, 15);
    if (vistosKey[normKey]) continue;
    vistosKey[normKey] = true;

    resultado.push({ monto: monto, comercio: comercio });
  }

  return resultado;
}

/**
 * Guarda el RUT en Script Properties (no en el código fuente).
 * Ejecutar UNA sola vez desde el editor, cambiando el valor por el RUT real.
 * El RUT se usa como contraseña en los PDFs de Santander.
 * Formato: solo números, sin guión, sin dígito verificador. Ej: "12345678"
 */
function setRutSantander() {
  var rut = '12345678'; // ← CAMBIAR por RUT real antes de ejecutar
  PropertiesService.getScriptProperties().setProperty('RUT_SANTANDER', rut);
  Logger.log('✅ RUT guardado en Script Properties: ' + rut);
}

function formatMonto(n) {
  return '$' + Math.round(Number(n)||0).toLocaleString('es-CL');
}

/**
 * Busca en Pendientes una fila de Santander con monto=0 dentro de ±48h
 * de la fecha dada y cuyo comercio haga fuzzy-match con el texto OCR.
 * Devuelve el número de fila (base 1, incluyendo header) o 0 si no hay match.
 */
function buscarPendienteCeroSantander_(pendSheet, comercioOcr, fechaOcr) {
  var lastRow = pendSheet.getLastRow();
  if (lastRow < 2) return 0;
  var numRows = lastRow - 1;
  var data = pendSheet.getRange(2, 1, numRows, 8).getValues();
  var fechaRef = new Date(fechaOcr);
  var ventana = 48 * 60 * 60 * 1000; // 48 horas en ms
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var monto = parseFloat(row[3] || 0);
    var banco = String(row[5] || '').toLowerCase();
    var procesado = String(row[7] || '').toUpperCase();
    // Solo filas Santander, con monto=0, no procesadas
    if (monto !== 0) continue;
    if (banco.indexOf('santander') === -1) continue;
    if (procesado === 'SI') continue;
    // Fecha dentro de ±48h
    var fechaFila = new Date(String(row[1] || ''));
    if (isNaN(fechaFila.getTime())) continue;
    var diff = Math.abs(fechaFila.getTime() - fechaRef.getTime());
    if (diff > ventana) continue;
    // Fuzzy match del comercio
    if (fuzzyMatchComercio_(comercioOcr, String(row[2] || ''))) {
      return i + 2; // +1 header, +1 base-1
    }
  }
  return 0;
}

/**
 * Coincidencia difusa de nombres de comercio.
 * Normaliza acentos y caracteres especiales, luego verifica
 * si al menos 1 palabra significativa (≥3 chars) es común a ambos nombres.
 */
function fuzzyMatchComercio_(a, b) {
  if (!a || !b) return false;
  var norm = function(s) {
    return s.toUpperCase()
      .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E')
      .replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÖ]/g, 'O')
      .replace(/[ÚÙÛÜ]/g, 'U').replace(/Ñ/g, 'N')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  var wordsA = norm(a).split(' ').filter(function(w) { return w.length >= 3; });
  var wordsB = norm(b).split(' ').filter(function(w) { return w.length >= 3; });
  if (!wordsA.length || !wordsB.length) return false;
  var setB = {};
  wordsB.forEach(function(w) { setB[w] = true; });
  return wordsA.some(function(w) { return setB[w]; });
}

/**
 * Verifica si ya existe en Pendientes una transacción con el mismo comercio
 * (fuzzy), mismo monto y fecha cercana (±3 días).
 * Evita duplicados al reconciliar la cartola contra movimientos ya registrados.
 */
function existeTransaccionDuplicada_(pendSheet, comercio, monto, fechaStr) {
  var lastRow = pendSheet.getLastRow();
  if (lastRow < 2) return false;
  var data = pendSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var fechaRef = new Date(fechaStr);
  var ventana = 3 * 24 * 60 * 60 * 1000; // ±3 días
  for (var i = 0; i < data.length; i++) {
    var rowMonto = parseFloat(data[i][3] || 0);
    if (rowMonto === 0) continue; // monto=0 ya lo maneja buscarPendienteCeroSantander_
    if (Math.abs(rowMonto - monto) > Math.max(1, monto * 0.01)) continue;
    var rowFecha = new Date(String(data[i][1] || ''));
    if (isNaN(rowFecha.getTime())) continue;
    if (Math.abs(rowFecha.getTime() - fechaRef.getTime()) > ventana) continue;
    if (fuzzyMatchComercio_(comercio, String(data[i][2] || ''))) return true;
  }
  return false;
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

// ============================================================
// HISTÓRICO — ejecutar UNA sola vez para importar meses anteriores
// ============================================================

/**
 * Procesa TODAS las cartolas y estados de cuenta Santander del último año.
 * Ejecutar una sola vez para importar meses anteriores al sistema.
 * Puede tardar 2-5 minutos dependiendo de cuántos PDFs haya.
 * Anti-duplicados activo: no crea filas que ya existan.
 */
/**
 * Limpia filas con nombres claramente erróneos generados por el parser anterior.
 * Ejecutar ANTES de reconciliarHistorico() si ya corriste una versión con errores.
 */
function limpiarFilasCartolaMalas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.PENDIENTES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Nada que limpiar'); return; }
  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var eliminadas = 0;
  // Recorrer de abajo hacia arriba para no desplazar índices
  for (var i = data.length - 1; i >= 0; i--) {
    var comercio = String(data[i][2] || '');
    var procesado = String(data[i][7] || '').toUpperCase();
    if (procesado === 'SI') continue; // no tocar lo ya categorizado
    var esMalo = /^santander\s*\(cartola\)$/i.test(comercio) ||
                 /^-?\$/.test(comercio) ||
                 /^-?USD/i.test(comercio) ||
                 /^-?[\d.,]+$/.test(comercio.trim());
    if (esMalo) {
      sheet.deleteRow(i + 2); // +2 por header + base-1
      eliminadas++;
    }
  }
  SpreadsheetApp.flush();
  Logger.log('✅ Eliminadas ' + eliminadas + ' filas con nombres incorrectos');
}

/**
 * Muestra los primeros 3000 caracteres del texto extraído del PDF de cartola
 * más reciente. Ejecutar para diagnosticar el formato real del PDF.
 */
function debugTextoPDF() {
  var rut = PropertiesService.getScriptProperties().getProperty('RUT_SANTANDER') || '';
  if (!rut) { Logger.log('❌ Configura RUT primero'); return; }

  // Buscar específicamente el Estado de Cuenta TC (tiene las compras con tarjeta)
  var queries = [
    'from:mensajeria@santander.cl subject:"estado de cuenta" newer_than:90d',
    'from:mensajeria@santander.cl subject:"cartola" newer_than:90d',
  ];

  queries.forEach(function(q) {
    var hilos = GmailApp.search(q, 0, 3);
    hilos.forEach(function(hilo) {
      hilo.getMessages().forEach(function(msg) {
        Logger.log('=== EMAIL: "' + msg.getSubject() + '" — ' + msg.getDate() + ' ===');
        var atts = msg.getAttachments();
        atts.forEach(function(att) {
          if (att.getContentType() !== 'application/pdf') return;
          var resp = UrlFetchApp.fetch(CONFIG.APP_URL + '/.netlify/functions/extract-pdf', {
            method: 'POST', contentType: 'application/json',
            payload: JSON.stringify({ pdfBase64: Utilities.base64Encode(att.getBytes()), password: rut }),
            muteHttpExceptions: true,
          });
          var result = JSON.parse(resp.getContentText());
          Logger.log('Páginas: ' + result.pages + ' | Chars: ' + (result.text || '').length);
          // Mostrar desde donde empieza "DETALLE" para saltar el encabezado
          var texto = result.text || '';
          var posDetalle = texto.search(/detalle|movimiento|transacci/i);
          var inicio = posDetalle > 0 ? posDetalle : 0;
          Logger.log('--- TEXTO desde "DETALLE" ---');
          Logger.log(texto.slice(inicio, inicio + 4000));
          Logger.log('--- FIN ---');
        });
      });
    });
  });
}

function reconciliarHistorico() {
  Logger.log('=== HISTÓRICO: importando cartolas del último año ===');
  var rut = PropertiesService.getScriptProperties().getProperty('RUT_SANTANDER') || '';
  if (!rut) { Logger.log('❌ RUT no configurado'); return; }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  var seenMsg = new Set();
  var nuevos = 0;

  var queries = [
    'from:mensajeria@santander.cl (subject:"estado de cuenta" OR subject:"cartola" OR subject:"resumen de cuenta") newer_than:365d',
    'from:notificaciones@santander.cl (subject:"estado de cuenta" OR subject:"cartola") newer_than:365d',
  ];

  queries.forEach(function(q) {
    var hilos = GmailApp.search(q, 0, 50);
    Logger.log('Query: ' + q + ' → ' + hilos.length + ' hilos');
    hilos.forEach(function(hilo) {
      hilo.getMessages().forEach(function(msg) {
        var msgId = msg.getId();
        if (seenMsg.has(msgId)) return;
        seenMsg.add(msgId);
        Logger.log('Email: "' + msg.getSubject() + '" ' + msg.getDate());
        var atts = msg.getAttachments();
        atts.forEach(function(att) {
          if (att.getContentType() !== 'application/pdf') return;
          try {
            var resp = UrlFetchApp.fetch(CONFIG.APP_URL + '/.netlify/functions/extract-pdf', {
              method: 'POST', contentType: 'application/json',
              payload: JSON.stringify({ pdfBase64: Utilities.base64Encode(att.getBytes()), password: rut }),
              muteHttpExceptions: true,
            });
            var result = JSON.parse(resp.getContentText());
            if (resp.getResponseCode() !== 200) { Logger.log('  ❌ ' + (result.error || resp.getResponseCode())); return; }
            var texto = result.text || '';
            var fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
            // Solo procesar Estado de Cuenta TC; cartolas de CTA CTE son transferencias, no gastos
            var esTC = /estado de cuenta/i.test(msg.getSubject());
            if (!esTC) { Logger.log('  ⏭ Cartola CTA CTE — omitida'); return; }
            var txs = parsearTransaccionesEstadoCuentaTC_(texto);
            Logger.log('  ' + txs.length + ' transacciones (' + result.pages + ' págs)');

            // Set local para evitar duplicados DENTRO del mismo PDF
            var localSeen = {};
            txs.forEach(function(t) {
              var localKey = t.fecha + '|' + t.monto + '|' + t.comercio.slice(0, 10).toUpperCase();
              if (localSeen[localKey]) return;
              localSeen[localKey] = true;

              var matchRow = buscarPendienteCeroSantander_(pendSheet, t.comercio, t.fecha);
              if (matchRow > 0) {
                pendSheet.getRange(matchRow, 4).setValue(t.monto);
                SpreadsheetApp.flush();
                Logger.log('  ✅ Rellenado: ' + t.comercio + ' $' + t.monto);
                nuevos++;
                return;
              }
              if (existeTransaccionDuplicada_(pendSheet, t.comercio, t.monto, t.fecha)) {
                Logger.log('  ⏭ Ya existe: ' + t.comercio + ' $' + t.monto);
                return;
              }
              var uid = Utilities.getUuid().slice(0, 8);
              pendSheet.appendRow([uid, t.fecha, t.comercio, t.monto, 'TC Santander', 'Santander', msgId + '_' + uid, 'NO']);
              SpreadsheetApp.flush(); // flush inmediato para que existeTransaccionDuplicada_ lo vea
              Logger.log('  ➕ Nueva: ' + t.comercio + ' $' + t.monto);
              nuevos++;
            });
          } catch (e) {
            Logger.log('  ❌ ' + e.message);
          }
        });
      });
    });
  });
  Logger.log('=== FIN: ' + nuevos + ' transacciones ===');
}

/**
 * Parser para Estado de Cuenta Tarjeta de Crédito Santander.
 *
 * Formato real del PDF (extraído con pdfjs-dist):
 *   LUGAR\nDD/MM/YYYY\nNOMBRE COMERCIO\n[PAIS\nMONTO_EXT,00\n]$ MONTO_CLP[SIGUIENTE_LUGAR]
 *
 * La fecha aparece sola en su línea. El comercio va después de la fecha.
 * El monto CLP empieza con "$ " y usa puntos como separadores de miles (sin coma).
 * Los montos en moneda extranjera tienen coma decimal (ej: 18.476,00) → se ignoran.
 * Las líneas de pago ("MONTO CANCELADO") se excluyen.
 */
function parsearTransaccionesEstadoCuentaTC_(texto) {
  var txs = [];
  if (!texto) return txs;
  var lineas = texto.split(/[\n\r]+/).map(function(l){ return l.trim(); }).filter(Boolean);

  var fechaRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var ignorar = /monto cancelado|saldo adeudado|monto facturado|monto pagado|total operaciones|movimientos tarjeta|cuota comercio|valor cuota|compras p\.a\.t\.|pago autom|cobro anu|periodo anterior|periodo actual|detalle|desde|hasta/i;

  for (var i = 0; i < lineas.length; i++) {
    var dateM = lineas[i].match(fechaRe);
    if (!dateM) continue;

    var fecha = dateM[3] + '-' + dateM[2] + '-' + dateM[1];

    // Comercio: primera línea no-genérica después de la fecha
    var comercio = null;
    for (var j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
      var c = lineas[j];
      if (fechaRe.test(c)) break;               // otra fecha → stop
      if (/^\$/.test(c)) break;                 // ya llegamos al monto → stop
      if (/^[A-Z]{2}$/.test(c)) continue;       // código de país (AR, US, CL) → skip
      if (ignorar.test(c)) break;               // línea ignorable → stop
      if (c.length < 2) continue;
      comercio = c;
      break;
    }
    if (!comercio) continue;
    if (ignorar.test(comercio)) continue;

    // Monto CLP: primera línea que empiece con "$ " y NO tenga coma (los de moneda ext tienen coma)
    var monto = null;
    for (var k = i + 1; k < Math.min(i + 8, lineas.length); k++) {
      var kl = lineas[k];
      if (fechaRe.test(kl)) break;                        // otra fecha → stop
      if (/^\d[\d.]+,\d+$/.test(kl)) continue;           // monto extranjero (18.476,00) → skip
      var mM = kl.match(/^\$\s*([\d.]+)/);               // $ X.XXX o $ X.XXX.XXX
      if (mM) {
        var n = parseFloat(mM[1].replace(/\./g, ''));
        if (n >= 100 && n <= 50000000) { monto = n; break; }
      }
    }
    if (!monto) continue;

    txs.push({ fecha: fecha, comercio: comercio.slice(0, 60), monto: Math.round(monto) });
  }
  return txs;
}

// ============================================================
// CONFIGURAR ACTIVADORES — ejecutar UNA sola vez
// ============================================================

/**
 * Configura el trigger de scanearGmail cada 10 minutos.
 * Ejecutar desde el editor de Apps Script: seleccionar esta función → ▶ Ejecutar.
 * Solo hace falta correrla una vez; elimina duplicados automáticamente.
 */
function configurarActivadores() {
  // Eliminar activadores previos para evitar duplicados
  var existentes = ScriptApp.getProjectTriggers();
  Logger.log('Triggers existentes: ' + existentes.length);
  existentes.forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'scanearGmail' || fn === 'enviarResumenDiario') {
      ScriptApp.deleteTrigger(t);
      Logger.log('  Eliminado: ' + fn);
    }
  });
  // scanearGmail cada 10 minutos
  ScriptApp.newTrigger('scanearGmail').timeBased().everyMinutes(10).create();
  // Resumen diario a las 8 AM
  ScriptApp.newTrigger('enviarResumenDiario').timeBased().atHour(8).everyDays(1).create();
  Logger.log('✅ Activadores creados: scanearGmail cada 10 min + resumen 8 AM');
  // Verificar que quedaron bien
  var activos = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); });
  Logger.log('Triggers activos ahora: ' + activos.join(', '));
}

// ============================================================
// RECONCILIACIÓN FIN DE MES — se ejecuta automáticamente y también manualmente
// ============================================================

/**
 * Wrapper manual: fuerza re-escaneo de los últimos 35 días de cartolas.
 * Útil si algo falló en el proceso automático.
 */
function reconciliarCartola() {
  Logger.log('=== RECONCILIACIÓN MANUAL ===');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  // procesados vacío → permite re-procesar emails ya vistos
  var n = scanearEstadoCuentaSantander_(pendSheet, new Set(), new Set());
  Logger.log('=== FIN: ' + n + ' transacciones procesadas ===');
}

// ============================================================
// PARSER CARTOLAS Y ESTADOS DE CUENTA SANTANDER
// ============================================================

/**
 * Detecta emails de Santander con PDF de estado de cuenta/cartola y los
 * desencripta automáticamente via Netlify extract-pdf usando el RUT guardado
 * en Script Properties. No requiere ninguna acción manual del usuario.
 *
 * CONFIGURACIÓN ÚNICA: ejecutar setRutSantander() una sola vez.
 */
function scanearEstadoCuentaSantander_(pendSheet, procesados, seenMsg) {
  var rut = PropertiesService.getScriptProperties().getProperty('RUT_SANTANDER') || '';
  if (!rut) {
    Logger.log('scanearEstadoCuenta: RUT no configurado — ejecuta setRutSantander() una vez');
    return 0;
  }

  var nuevos = 0;
  var queries = [
    'from:mensajeria@santander.cl (subject:"estado de cuenta" OR subject:"cartola" OR subject:"resumen de cuenta") newer_than:35d',
    'from:notificaciones@santander.cl (subject:"estado de cuenta" OR subject:"cartola") newer_than:35d',
  ];
  queries.forEach(function(q) {
    try {
      var hilos = GmailApp.search(q, 0, 5);
      hilos.forEach(function(hilo) {
        hilo.getMessages().forEach(function(msg) {
          var msgId = msg.getId();
          if (seenMsg.has(msgId) || procesados.has(msgId)) return;
          seenMsg.add(msgId);

          var fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
          var transacciones = [];

          // Desencriptar PDF via Netlify extract-pdf (usa RUT como contraseña)
          var attachments = msg.getAttachments();
          attachments.forEach(function(att) {
            if (att.getContentType() !== 'application/pdf') return;
            Logger.log('Cartola PDF: ' + att.getName());
            try {
              var pdfBase64 = Utilities.base64Encode(att.getBytes());
              var resp = UrlFetchApp.fetch(CONFIG.APP_URL + '/.netlify/functions/extract-pdf', {
                method: 'POST',
                contentType: 'application/json',
                payload: JSON.stringify({ pdfBase64: pdfBase64, password: rut }),
                muteHttpExceptions: true,
              });
              var status = resp.getResponseCode();
              var result = JSON.parse(resp.getContentText());
              if (status !== 200) {
                Logger.log('  extract-pdf error ' + status + ': ' + (result.error || ''));
                return;
              }
              var texto = result.text || '';
              Logger.log('  Texto: ' + texto.length + ' chars, ' + result.pages + ' páginas');
              // Solo Estado de Cuenta TC tiene compras; cartolas de CTA CTE son transferencias
              var esTC = /estado de cuenta/i.test(msg.getSubject());
              if (!esTC) { Logger.log('  ⏭ Cartola CTA CTE — omitida'); return; }
              transacciones = transacciones.concat(parsearTransaccionesEstadoCuentaTC_(texto));
            } catch (e) {
              Logger.log('  Error extract-pdf: ' + e.message);
            }
          });

          Logger.log('Cartola transacciones: ' + transacciones.length);
          transacciones.forEach(function(t) {
            var fechaTx = t.fecha || fecha;

            // 1. ¿Hay Pendiente monto=0 con mismo comercio/fecha? → rellenar monto
            var matchRow = buscarPendienteCeroSantander_(pendSheet, t.comercio, fechaTx);
            if (matchRow > 0) {
              pendSheet.getRange(matchRow, 4).setValue(t.monto);
              Logger.log('  ✅ Monto rellenado fila ' + matchRow + ': ' + t.comercio + ' $' + t.monto);
              nuevos++;
              return;
            }

            // 2. ¿Ya existe la transacción con monto correcto? → no duplicar
            if (existeTransaccionDuplicada_(pendSheet, t.comercio, t.monto, fechaTx)) {
              Logger.log('  ⏭ Ya existe: ' + t.comercio + ' $' + t.monto + ' (' + fechaTx + ')');
              return;
            }

            // 3. Transacción nueva, no capturada antes → agregar
            var uid = Utilities.getUuid().slice(0, 8);
            pendSheet.appendRow([uid, fechaTx, t.comercio, t.monto, 'TC Santander', 'Santander', msgId + '_' + uid, 'NO']);
            Logger.log('  ➕ Nueva: ' + t.comercio + ' $' + t.monto);
            nuevos++;
          });
          if (transacciones.length) procesados.add(msgId);
        });
      });
    } catch (e) {
      Logger.log('scanearEstadoCuenta error: ' + e.message);
    }
  });
  return nuevos;
}

/**
 * Extrae transacciones individuales de un texto de cartola/estado de cuenta.
 * Formato Santander TC típico: COMERCIO    DD/MM/AAAA    $XX.XXX
 */
function parsearTransaccionesDeCuerpo_(texto, banco) {
  var transacciones = [];
  if (!texto) return transacciones;
  // Patrón: texto con fecha DD/MM/YYYY y monto $X.XXX o X.XXX
  // Líneas tipo: "JUMBO VITACURA        05/06/2026      45.990"
  var lineas = texto.split(/[\n\r]+/);
  var montoRe = /\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{4,})/;
  var fechaRe = /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/;
  lineas.forEach(function(linea) {
    linea = linea.trim();
    if (linea.length < 10) return;
    // Ignorar líneas de totales o headers
    if (/total|saldo|disponible|l.mite|cupo|pago m.nimo|fecha\s+descripci/i.test(linea)) return;
    var fechaM = linea.match(fechaRe);
    var montoM = linea.match(montoRe);
    if (!fechaM || !montoM) return;
    var monto = parseFloat(String(montoM[1]).replace(/\./g, '').replace(',', '.'));
    if (!monto || monto < 100 || monto > 50000000) return;
    // Fecha en formato YYYY-MM-DD
    var fecha = fechaM[3] + '-' + fechaM[2] + '-' + fechaM[1];
    // Comercio: texto antes de la fecha
    var comercio = linea.slice(0, linea.indexOf(fechaM[0])).trim().replace(/\s{2,}/g, ' ');
    if (!comercio || comercio.length < 2) comercio = banco + ' (cartola)';
    // Ignorar abonos (números negativos o líneas con "abono"/"pago")
    if (/abono|pago\s+cuenta|pago\s+tc/i.test(linea)) return;
    transacciones.push({ fecha: fecha, comercio: comercio.slice(0, 60), monto: Math.round(monto) });
  });
  return transacciones;
}

// ============================================================
// DEBUG EMAILS — Diagnosticar por qué no se capturan los screenshots
// ============================================================

/**
 * Ejecuta esto para ver exactamente qué encuentra el scanner de screenshots.
 * Revisa el log después de ejecutar (Ver → Registros).
 */
/**
 * Busca TODOS los emails recientes tuyos (con y sin adjunto) para
 * encontrar cuál enviaste con el screenshot. Úsala para identificar el asunto exacto.
 */
function debugBuscarEmailConImagen() {
  Logger.log('=== BUSCAR EMAIL CON IMAGEN (últimos 7 días) ===');

  // Buscar cualquier email DE ti, con attachment
  var queries = [
    'from:' + CONFIG.EMAIL_DESTINO + ' has:attachment newer_than:7d',
    'from:' + CONFIG.EMAIL_DESTINO + ' newer_than:2d', // cualquier email tuyo reciente
  ];

  queries.forEach(function(q) {
    Logger.log('--- Query: ' + q);
    var hilos = GmailApp.search(q, 0, 20);
    Logger.log('  Hilos: ' + hilos.length);
    hilos.forEach(function(h) {
      h.getMessages().forEach(function(m) {
        var atts = m.getAttachments({ includeInlineImages: true });
        var tipos = atts.map(function(a) { return a.getContentType(); }).join(', ');
        Logger.log('  • Asunto: "' + m.getSubject() + '" | Adjuntos: ' + atts.length + (tipos ? ' (' + tipos + ')' : ''));
      });
    });
  });
  Logger.log('=== FIN ===');
}

function debugScreenshotEmail() {
  Logger.log('=== DEBUG SCREENSHOT EMAIL ===');

  // Paso 1: ¿Encuentra los emails?
  var q = 'from:' + CONFIG.EMAIL_DESTINO + ' (subject:gasto OR subject:💳 OR subject:santander OR subject:captura OR subject:compra) newer_than:7d';
  Logger.log('Query usada: ' + q);
  var hilos = GmailApp.search(q, 0, 10);
  Logger.log('Hilos encontrados con ese query: ' + hilos.length);

  if (!hilos.length) {
    Logger.log('⚠️  PROBLEMA: no se encontraron emails. Verifica el asunto del correo que mandaste.');
    Logger.log('   El asunto debe contener: gasto, 💳, santander, captura, o compra');
    // Intentar buscar cualquier email reciente tuyo para confirmar que el email llega
    var cualquiera = GmailApp.search('from:' + CONFIG.EMAIL_DESTINO + ' newer_than:1d', 0, 5);
    Logger.log('Emails recientes tuyos (cualquier asunto): ' + cualquiera.length);
    cualquiera.forEach(function(h) {
      h.getMessages().forEach(function(m) {
        Logger.log('  Asunto: "' + m.getSubject() + '"');
      });
    });
    return;
  }

  // Paso 2: Para cada email, ¿tiene adjuntos o imágenes?
  hilos.forEach(function(hilo, hi) {
    hilo.getMessages().forEach(function(msg, mi) {
      Logger.log('--- Email [' + hi + '.' + mi + ']: "' + msg.getSubject() + '"');

      // Adjuntos con imágenes inline también
      var attsAll = msg.getAttachments({ includeInlineImages: true, includeAttachments: true });
      var attsNormal = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
      Logger.log('  Adjuntos (solo archivos): ' + attsNormal.length);
      Logger.log('  Adjuntos (incluyendo imágenes inline): ' + attsAll.length);

      if (!attsAll.length) {
        Logger.log('  ⚠️  Sin adjuntos. La imagen puede estar solo en el cuerpo HTML — no es extraíble por OCR.');
        return;
      }

      attsAll.forEach(function(att, ai) {
        Logger.log('  Adjunto [' + ai + ']: tipo=' + att.getContentType() + ' | nombre=' + att.getName() + ' | bytes=' + att.getSize());

        if (!att.getContentType().startsWith('image/')) {
          Logger.log('    → No es imagen, se salta');
          return;
        }

        // Paso 3: ¿Funciona el OCR?
        try {
          var blob = att.copyBlob();
          Logger.log('    → Intentando OCR...');
          var file = Drive.Files.insert(
            { title: 'debug_ocr', mimeType: blob.getContentType() },
            blob,
            { ocr: true, ocrLanguage: 'es' }
          );
          var doc = DocumentApp.openById(file.id);
          var texto = doc.getBody().getText();
          DriveApp.getFileById(file.id).setTrashed(true);

          if (!texto || texto.length < 5) {
            Logger.log('    ⚠️  OCR no extrajo texto (imagen ilegible o muy pequeña)');
            return;
          }
          Logger.log('    ✅ OCR texto extraído (' + texto.length + ' chars): "' + texto.slice(0, 400) + '"');

          // Paso 4: ¿Parsea el monto?
          var monto = parseMontoDesdeCorreoSantanderTC_(texto) || parseMontoDesdeCorreoBancoDeChile_(texto);
          Logger.log('    Monto parseado: ' + (monto || '⚠️  NO ENCONTRADO'));
        } catch (e) {
          Logger.log('    ❌ Error OCR: ' + e.message);
        }
      });
    });
  });
  Logger.log('=== FIN DEBUG ===');
}

// Test manual — ejecutar para verificar que el script funciona
// Usa ventana de 7 días para encontrar correos antiguos durante pruebas.
// El trigger automático usa 1 hora (para no hacer timeout).
function testManual() {
  Logger.log('=== TEST MANUAL (ventana 7 días) ===');
  Logger.log('Sheet ID: ' + SpreadsheetApp.getActiveSpreadsheet().getId());
  Logger.log('Email destino: ' + CONFIG.EMAIL_DESTINO);
  Logger.log('App URL: ' + CONFIG.APP_URL);
  scanearGmail(168); // 168 horas = 7 días
  Logger.log('=== FIN TEST ===');
}

// Test rápido — solo última hora (mismo que el trigger automático)
function testRapido() {
  Logger.log('=== TEST RÁPIDO (ventana 1 hora) ===');
  scanearGmail(1);
  Logger.log('=== FIN TEST RÁPIDO ===');
}

/**
 * Prueba SOLO el scanner de screenshots (sin cartola ni bancos).
 * Útil para diagnosticar si los emails con imágenes se capturan correctamente.
 * Ejecutar desde el editor → Ver → Registros para ver el detalle.
 */
function testSoloScreenshots() {
  Logger.log('=== TEST SOLO SCREENSHOTS (ventana 7 días) ===');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pendSheet = ss.getSheetByName(SHEETS.PENDIENTES);
  // Construir set de IDs ya procesados
  var procesados = new Set();
  if (pendSheet.getLastRow() > 1) {
    var ids = pendSheet.getRange(2, 7, pendSheet.getLastRow() - 1, 1).getValues().flat();
    ids.forEach(function(id) { if (id) procesados.add(id); });
  }
  var seenMsg = new Set();
  var n = scanearScreenshotsEmail_(pendSheet, procesados, seenMsg, '7d');
  Logger.log('=== FIN: ' + n + ' nuevos registrados ===');
}
