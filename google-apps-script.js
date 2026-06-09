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

  // ---- ESTADO DE CUENTA MENSUAL SANTANDER (PDF adjunto) ----
  // Solo correr si hay tiempo suficiente; cartola es mensual, no necesita ventana corta.
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
  // Sin "has:attachment": captura tanto adjuntos como imágenes inline del body del email.
  // Sujeto específico evita falsos positivos.
  const q = 'from:' + CONFIG.EMAIL_DESTINO + ' (subject:gasto OR subject:💳 OR subject:santander OR subject:captura OR subject:compra) newer_than:' + ventana;
  var nuevos = 0;
  try {
    var hilos = GmailApp.search(q, 0, 10);
    hilos.forEach(function(hilo) {
      hilo.getMessages().forEach(function(msg) {
        var msgId = msg.getId();
        if (seenMsg.has(msgId) || procesados.has(msgId)) return;
        seenMsg.add(msgId);

        var attachments = msg.getAttachments();
        attachments.forEach(function(att) {
          var tipo = att.getContentType();
          if (!tipo.startsWith('image/')) return;

          try {
            // OCR nativo vía Drive API (requiere servicio Drive habilitado)
            var blob = att.copyBlob();
            var file = Drive.Files.insert(
              { title: 'ocr_finanzas_temp', mimeType: blob.getContentType() },
              blob,
              { ocr: true, ocrLanguage: 'es' }
            );
            var doc = DocumentApp.openById(file.id);
            var texto = doc.getBody().getText();
            DriveApp.getFileById(file.id).setTrashed(true);

            if (!texto || texto.length < 5) return;

            var monto = parseMontoDesdeCorreoSantanderTC_(texto) ||
                        parseMontoDesdeCorreoBancoDeChile_(texto);
            if (!monto || monto <= 0) {
              Logger.log('Screenshot OCR: no se encontró monto en texto: ' + texto.slice(0, 200));
              return;
            }

            // Extraer comercio desde texto OCR.
            // Prueba varios patrones en orden de especificidad.
            var comercio = 'Santander (captura)';
            var cmPatterns = [
              // "en COMERCIO el DD" — correos
              /en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r]{2,40}?)(?:\s+el\s+\d|\s+\$)/im,
              // "en COMERCIO\n" — notif push, el comercio va en línea propia después de "en"
              /en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r]{2,40})/im,
              // "Compra en COMERCIO" / "Cargo en COMERCIO"
              /(?:compra|cargo|consumo)\s+en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r]{2,40})/im,
              // Primera línea en mayúsculas tras "Santander" — asume que es el comercio
              /santander[^\n]*\n([A-ZÁÉÍÓÚÑ][^\n]{3,40})/im,
            ];
            for (var pi = 0; pi < cmPatterns.length; pi++) {
              var cm = texto.match(cmPatterns[pi]);
              if (cm && cm[1] && cm[1].trim().length >= 3) {
                comercio = cm[1].trim().slice(0, 60);
                break;
              }
            }
            var fecha = Utilities.formatDate(msg.getDate(), CONFIG.TIMEZONE, 'yyyy-MM-dd');

            // ---- SMART MERCHANT MATCHING ----
            // Si hay un Pendiente de Santander con monto=0 reciente que coincide
            // con este comercio, actualizamos su monto en lugar de crear duplicado.
            var matchRow = buscarPendienteCeroSantander_(pendSheet, comercio, fecha);
            if (matchRow > 0) {
              pendSheet.getRange(matchRow, 4).setValue(monto);
              Logger.log('✅ Smart match: fila ' + matchRow + ' actualizada → ' + comercio + ' $' + monto);
            } else {
              var uid = Utilities.getUuid().slice(0, 8);
              pendSheet.appendRow([uid, fecha, comercio, monto, 'TC Santander', 'Santander', msgId, 'NO']);
              Logger.log('Screenshot OCR registrado: ' + comercio + ' $' + monto);
            }
            nuevos++;
          } catch (ocrErr) {
            Logger.log('Error OCR screenshot: ' + ocrErr.message);
          }
        });
      });
    });
  } catch (e) {
    Logger.log('scanearScreenshotsEmail error: ' + e.message);
  }
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
// CONFIGURAR ACTIVADORES — ejecutar UNA sola vez
// ============================================================

/**
 * Configura el trigger de scanearGmail cada 10 minutos.
 * Ejecutar desde el editor de Apps Script: seleccionar esta función → ▶ Ejecutar.
 * Solo hace falta correrla una vez; elimina duplicados automáticamente.
 */
function configurarActivadores() {
  // Eliminar activadores previos de scanearGmail para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'scanearGmail' ||
        t.getHandlerFunction() === 'enviarResumenDiario') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // scanearGmail cada 10 minutos
  ScriptApp.newTrigger('scanearGmail')
    .timeBased()
    .everyMinutes(10)
    .create();
  // Resumen diario a las 8 AM
  ScriptApp.newTrigger('enviarResumenDiario')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  Logger.log('✅ Activadores configurados: scanearGmail cada 10 min + resumen 8 AM');
  // Nota: SpreadsheetApp.getUi() solo funciona si el script fue abierto DESDE el Sheet.
  // Si lo ejecutas desde el editor directo, el log es suficiente — no necesitas la alerta.
  try {
    SpreadsheetApp.getUi().alert('✅ Listo:\n• scanearGmail: cada 10 minutos\n• Resumen diario: 8:00 AM');
  } catch (e) {
    Logger.log('(Sin UI disponible — el activador igual quedó configurado correctamente)');
  }
}

// ============================================================
// PARSER CARTOLAS Y ESTADOS DE CUENTA SANTANDER
// ============================================================

/**
 * Parsea el estado de cuenta mensual TC Santander (email con PDF adjunto).
 * Usa el mismo OCR de Drive que los screenshots.
 * El email llega de mensajeria@santander.cl con asunto "Estado de Cuenta".
 */
function scanearEstadoCuentaSantander_(pendSheet, procesados, seenMsg) {
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

          // Intentar extraer transacciones del cuerpo HTML primero
          var cuerpo = msg.getPlainBody() || '';
          var transacciones = parsearTransaccionesDeCuerpo_(cuerpo, 'Santander');

          // Si el cuerpo no tiene datos, intentar con PDF adjunto via OCR
          if (!transacciones.length) {
            var attachments = msg.getAttachments();
            attachments.forEach(function(att) {
              var tipo = att.getContentType();
              if (tipo !== 'application/pdf' && !tipo.startsWith('image/')) return;
              try {
                var blob = att.copyBlob();
                var file = Drive.Files.insert(
                  { title: 'ocr_cartola_temp', mimeType: blob.getContentType() },
                  blob,
                  { ocr: true, ocrLanguage: 'es' }
                );
                var doc = DocumentApp.openById(file.id);
                var texto = doc.getBody().getText();
                DriveApp.getFileById(file.id).setTrashed(true);
                if (texto) transacciones = transacciones.concat(parsearTransaccionesDeCuerpo_(texto, 'Santander'));
              } catch (e) {
                Logger.log('OCR cartola error: ' + e.message);
              }
            });
          }

          transacciones.forEach(function(t) {
            var uid = Utilities.getUuid().slice(0, 8);
            pendSheet.appendRow([uid, t.fecha, t.comercio, t.monto, 'TC Santander', 'Santander', msgId + '_' + uid, 'NO']);
            nuevos++;
            Logger.log('Cartola Santander: ' + t.comercio + ' $' + t.monto + ' ' + t.fecha);
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
