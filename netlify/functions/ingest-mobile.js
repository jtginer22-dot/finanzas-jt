'use strict';

const { getGoogleAccessTokenFromServiceAccount } = require('./lib/google-sheets-token');

/**
 * Ingesta segura de movimientos móviles (Shortcut/Scriptable).
 * Requiere APP_PASSCODE y escritura vía cuenta de servicio (recomendado) o GOOGLE_SHEETS_API_KEY solo para lectura dedupe legacy.
 */
exports.handler = async (event) => {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const serviceAccountPrivateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const requiredPasscode = process.env.APP_PASSCODE || '';
  const allowListRaw = process.env.SHEETS_ALLOWED_SPREADSHEET_IDS || '';
  const allowed = allowListRaw.split(',').map((s) => s.trim()).filter(Boolean);

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-passcode',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  if (!key && (!serviceAccountEmail || !serviceAccountPrivateKey)) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Falta autenticación de Google Sheets (API key o Service Account).' }) };
  }

  const pass = event.headers['x-app-passcode'] || event.headers['X-App-Passcode'] || '';
  if (requiredPasscode && pass !== requiredPasscode) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Passcode inválido o faltante' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body JSON inválido' }) };
  }

  const spreadsheetId = (body.spreadsheetId || '').trim();
  if (!spreadsheetId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta spreadsheetId' }) };
  if (allowed.length && !allowed.includes(spreadsheetId)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'spreadsheetId no permitido' }) };
  }

  /** Elige monto de compra entre varios $ en el texto (evita cupo/deuda total). */
  function pickTransactionMonto(amounts) {
    const valid = amounts.filter((n) => Number.isFinite(n) && n >= 50 && n < 15_000_000);
    if (!valid.length) return 0;
    valid.sort((a, b) => a - b);
    while (valid.length > 1) {
      const max = valid[valid.length - 1];
      const median = valid[Math.floor(valid.length / 2)];
      if (max > Math.max(median * 8, 800_000) && max > 1_000_000) valid.pop();
      else break;
    }
    return valid[0];
  }

  function parseMoneyFromNotificationText(text) {
    const raw = String(text ?? '').replace(/\u00A0/g, ' ').trim();
    if (!raw) return 0;
    const amounts = [];
    const compraRe = /(?:compra|consumo|cargo|monto|pagaste|pag[oó]|por)\s*(?:de\s*)?(?:en\s*)?(?:\$|CLP)?\s*([\d.,]+)/gi;
    let m;
    while ((m = compraRe.exec(raw)) !== null) {
      const p = parseMoney(m[1]);
      if (p > 0) amounts.push(p);
    }
    for (const m2 of raw.matchAll(/\$\s*([\d]{1,3}(?:\.\d{3})+)/g)) {
      const p = parseMoney(m2[1]);
      if (p > 0) amounts.push(p);
    }
    return pickTransactionMonto(amounts);
  }

  function parseMoney(input) {
    if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input);

    // Shortcuts a veces manda el monto en otra clave o anidado (Dictionary).
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      let best = 0;
      const candidateKeys = [
        'monto',
        'Monto',
        'amount',
        'Amount',
        'value',
        'Value',
        'importe',
        'Importe',
        'numberValue',
        'rawValue',
        'displayValue',
        'formatted',
        'WFCurrencyAmount', // Workflow/Shortcuts currency
        'amountValue',
      ];
      for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          const parsed = parseMoney(input[key]);
          if (parsed > best) best = parsed;
        }
      }
      if (best > 0) return best;
      for (const k of Object.keys(input)) {
        if (/monto|amount|import|valor|precio|total|price|currency/i.test(k)) {
          const parsed = parseMoney(input[k]);
          if (parsed > best) best = parsed;
        }
      }
      if (best > 0) return best;
      const collected = [];
      for (const v of Object.values(input)) {
        if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
          collected.push(Math.round(v));
        } else if (typeof v === 'string' && /[\d]/.test(v)) {
          const p = parseMoney(v);
          if (p > 0) collected.push(p);
        } else if (v && typeof v === 'object') {
          const p = parseMoney(v);
          if (p > 0) collected.push(p);
        }
      }
      return pickTransactionMonto(collected);
    }

    const raw = String(input ?? '')
      .replace(/\u00A0/g, ' ') // no-break space común en montos localizados
      .trim();
    if (!raw) return 0;

    // Formato chileno típico en texto: "45.990" o "CLP 45.990" (punto = miles).
    const digits = raw.replace(/[^\d.,-]/g, '');
    if (!digits) return 0;
    const sign = digits.startsWith('-') ? -1 : 1;
    const unsigned = digits.replace(/-/g, '');
    const lastComma = unsigned.lastIndexOf(',');
    const lastDot = unsigned.lastIndexOf('.');
    const decimalIdx = Math.max(lastComma, lastDot);
    let normalized;
    if (decimalIdx !== -1) {
      const after = unsigned.slice(decimalIdx + 1).replace(/[.,]/g, '');
      const before = unsigned.slice(0, decimalIdx).replace(/[.,]/g, '');
      if (after.length === 3 && /^\d{3}$/.test(after) && before.length >= 1) {
        normalized = `${before}${after}`;
      } else {
        const intPart = unsigned.slice(0, decimalIdx).replace(/[.,]/g, '');
        const decPart = after;
        normalized = `${intPart || '0'}.${decPart || '0'}`;
      }
    } else {
      normalized = unsigned.replace(/[.,]/g, '');
    }

    const n = Number(normalized);
    if (!Number.isFinite(n)) return 0;
    return sign * Math.round(n);
  }

  /** Prioriza texto de notificación; no usa el mayor $ del payload (cupo/deuda). */
  function extractMoneyFromBody(b) {
    const textKeys = ['texto', 'text', 'body', 'notification', 'mensaje', 'raw', 'clipboard', 'contenido'];
    let fromText = 0;
    for (const k of textKeys) {
      if (typeof b[k] === 'string' && b[k].trim()) {
        const p = parseMoneyFromNotificationText(b[k]);
        if (p > 0) {
          fromText = p;
          break;
        }
      }
    }
    const explicitKeys = [
      'monto', 'Monto', 'amount', 'Amount', 'importe', 'Importe',
      'value', 'Value', 'precio',
    ];
    let explicit = 0;
    for (const k of explicitKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      const v = b[k];
      if (v === null || v === undefined) continue;
      const p = parseMoney(v);
      if (p > 0 && (explicit === 0 || p < explicit)) explicit = p;
    }
    if (fromText > 0) {
      if (explicit <= 0 || explicit > fromText * 5 || explicit > 2_000_000) return fromText;
      return explicit;
    }
    if (explicit > 0) return explicit;
    // Wallet / transacción: buscar montos solo en claves conocidas (no stringify del dict entero).
    const walletAmountKeys = [
      'WFCurrencyAmount', 'transactionAmount', 'Transaction Amount', 'Importe', 'importe',
    ];
    const walletAmounts = [];
    for (const k of walletAmountKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      const p = parseMoney(b[k]);
      if (p > 0) walletAmounts.push(p);
    }
    if (walletAmounts.length) return pickTransactionMonto(walletAmounts);
    for (const k of Object.keys(b)) {
      if (typeof b[k] !== 'string') continue;
      if (!/\$|compra|cargo|consumo/i.test(b[k])) continue;
      const p = parseMoneyFromNotificationText(b[k]);
      if (p > 0) return p;
    }
    return 0;
  }

  const fecha = body.fecha || body.date || new Date().toISOString().split('T')[0];
  const monto = extractMoneyFromBody(body);
  const tarjeta = body.tarjeta || 'TC';
  const banco = body.banco || 'Santander';
  const emailId = body.emailId || '';

  const range = 'Pendientes!A:H';
  const apiBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;

  // ---- Helpers de smart matching (también usados abajo) ----
  function normComercio(s) {
    return String(s || '').toUpperCase()
      .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E')
      .replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÖ]/g, 'O')
      .replace(/[ÚÙÛÜ]/g, 'U').replace(/Ñ/g, 'N')
      .replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function fuzzyMatchComercio(a, b) {
    const wA = normComercio(a).split(' ').filter(w => w.length >= 3);
    const wB = normComercio(b).split(' ').filter(w => w.length >= 3);
    if (!wA.length || !wB.length) return false;
    const setB = new Set(wB);
    return wA.some(w => setB.has(w));
  }
  function extraerComercioDeTexto(texto) {
    if (!texto) return null;
    const pats = [
      /en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r$]{2,50}?)(?:\s+(?:por|by)\s+\$|\s*\n)/im,
      /(?:compra|cargo|consumo)\s+en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r]{2,50})/im,
      /en\s+([A-ZÁÉÍÓÚÑ0-9][^\n\r]{2,50})/im,
    ];
    for (const re of pats) {
      const m = texto.match(re);
      if (m && m[1] && m[1].trim().length >= 3) return m[1].trim().slice(0, 60);
    }
    return null;
  }

  try {
    const useServiceAccount = Boolean(serviceAccountEmail && serviceAccountPrivateKey);
    const authHeaders = useServiceAccount
      ? { Authorization: `Bearer ${await getGoogleAccessTokenFromServiceAccount(serviceAccountEmail, serviceAccountPrivateKey)}` }
      : {};
    const keyQuery = useServiceAccount ? '' : `?key=${encodeURIComponent(key)}`;

    // ====================================================================
    // FLUJO ESPECIAL: payload de screenshot/OCR (esCaptura = true)
    // El atajo de iOS hace OCR de la notificación Santander y manda el texto.
    // Intentamos actualizar el Pendiente $0 existente en lugar de crear uno nuevo.
    // ====================================================================
    if (body.esCaptura === true || body.origen === 'screenshot' || body.origen === 'captura') {
      const textoOcr = body.texto || body.text || body.notification || body.clipboard || '';
      const montoCaptura = extractMoneyFromBody(body);
      if (montoCaptura <= 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, warn: 'ocr_monto_cero', receivedKeys: Object.keys(body), textoOcr: textoOcr.slice(0, 300) }),
        };
      }
      const comercioCaptura = extraerComercioDeTexto(textoOcr) || body.comercio || body.Merchant || 'Santander (captura)';

      // Leer Pendientes para encontrar fila $0 que haga match
      const allUrl = `${apiBase}/${encodeURIComponent('Pendientes!A2:H5000')}${keyQuery}`;
      let matchRowNum = 0;
      try {
        const allResp = await fetch(allUrl, { headers: authHeaders });
        if (allResp.ok) {
          const allData = await allResp.json();
          const rows = allData.values || [];
          const fechaRef = new Date(fecha);
          const ventana48h = 48 * 60 * 60 * 1000;
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowMonto = parseFloat(row[3] || 0);
            const rowBanco = String(row[5] || '').toLowerCase();
            const rowProcesado = String(row[7] || '').toUpperCase();
            const rowFecha = new Date(String(row[1] || ''));
            if (rowMonto !== 0) continue;
            if (!rowBanco.includes('santander')) continue;
            if (rowProcesado === 'SI') continue;
            if (isNaN(rowFecha.getTime())) continue;
            if (Math.abs(rowFecha.getTime() - fechaRef.getTime()) > ventana48h) continue;
            if (fuzzyMatchComercio(comercioCaptura, String(row[2] || ''))) {
              matchRowNum = i + 2; // +1 header, +1 base-1
              break;
            }
          }
        }
      } catch (_e) { /* si falla la lectura, caer al append */ }

      if (matchRowNum > 0) {
        // Actualizar monto en fila existente (col D = 4)
        const updateRange = `Pendientes!D${matchRowNum}`;
        const updateUrl = `${apiBase}/${encodeURIComponent(updateRange)}?valueInputOption=RAW${keyQuery ? `&key=${encodeURIComponent(key)}` : ''}`;
        const updResp = await fetch(updateUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ range: updateRange, majorDimension: 'ROWS', values: [[montoCaptura]] }),
        });
        const updText = await updResp.text();
        if (!updResp.ok) return { statusCode: updResp.status, headers, body: updText };
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'OK', matched: true, monto: montoCaptura, comercio: comercioCaptura, rowUpdated: matchRowNum }) };
      }

      // Sin match: crear nueva fila
      const uidCaptura = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const appendUrl2 = `${apiBase}/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS${useServiceAccount ? '' : `&key=${encodeURIComponent(key)}`}`;
      const capturaRow = [[uidCaptura, fecha, comercioCaptura, montoCaptura, tarjeta || 'TC Santander', banco || 'Santander', '', 'NO']];
      const r2 = await fetch(appendUrl2, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ range, majorDimension: 'ROWS', values: capturaRow }),
      });
      const t2 = await r2.text();
      if (!r2.ok) return { statusCode: r2.status, headers, body: t2 };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, message: 'OK', matched: false, uid: uidCaptura, monto: montoCaptura, comercio: comercioCaptura }) };
    }

    // ====================================================================
    // FLUJO NORMAL: transacción de Wallet shortcut (existing)
    // ====================================================================
    const uid = body.uid || body.transactionIdentifier || body['Transaction Identifier'] || Date.now().toString(36);
    const comercio = body.comercio || body.Merchant || body.merchant || body.name || body.Name || 'Compra';
    const procesado = 'NO';
    const values = [[uid, fecha, comercio, monto, tarjeta, banco, emailId, procesado]];
    const payload = { range, majorDimension: 'ROWS', values };
    const dedupeRange = 'Pendientes!A2:A5000';
    const dedupeUrl = `${apiBase}/${encodeURIComponent(dedupeRange)}${keyQuery}`;
    const appendUrl = `${apiBase}/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS${useServiceAccount ? '' : `&key=${encodeURIComponent(key)}`}`;

    // Idempotencia: si ya existe el uid en Pendientes, no vuelve a insertar.
    // Esto evita duplicados cuando Atajos reintenta una automatización.
    const dedupe = await fetch(dedupeUrl, { headers: authHeaders });
    const dedupeText = await dedupe.text();
    if (dedupe.ok) {
      let parsed;
      try { parsed = JSON.parse(dedupeText); } catch { parsed = null; }
      const existing = new Set((parsed?.values || []).map((row) => String(row?.[0] || '').trim()).filter(Boolean));
      if (existing.has(String(uid).trim())) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, message: 'OK', uid, duplicate: true }),
        };
      }
    }

    const r = await fetch(appendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) return { statusCode: r.status, headers, body: text };
    const responseBody = { ok: true, message: 'OK', uid, monto };
    if (monto === 0) {
      responseBody.warn = 'monto_parseado_cero';
      responseBody.receivedKeys = Object.keys(body || {});
      // Devolver valores recibidos para diagnosticar qué envió el atajo de iOS
      const safeBody = {};
      for (const k of Object.keys(body || {})) {
        const v = body[k];
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') safeBody[k] = v;
        else if (v && typeof v === 'object') safeBody[k] = JSON.stringify(v);
        else safeBody[k] = String(v ?? '');
      }
      responseBody.receivedValues = safeBody;
    } else if (Math.abs(monto) >= 2_000_000) {
      responseBody.warn = 'monto_muy_alto_revisar';
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseBody),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
