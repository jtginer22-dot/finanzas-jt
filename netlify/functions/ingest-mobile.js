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
      for (const v of Object.values(input)) {
        if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
          const n = Math.round(v);
          if (n > best) best = n;
        } else if (typeof v === 'string' && /[\d]/.test(v)) {
          const p = parseMoney(v);
          if (p > best) best = p;
        } else if (v && typeof v === 'object') {
          const p = parseMoney(v);
          if (p > best) best = p;
        }
      }
      return best;
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

  /** Prueba varias claves de primer nivel; `??` no sirve si `monto` viene como "" */
  function extractMoneyFromBody(b) {
    const topKeys = [
      'monto', 'Monto', 'amount', 'Amount', 'importe', 'Importe',
      'value', 'Value', 'precio', 'total', 'Total',
    ];
    let best = 0;
    for (const k of topKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      const v = b[k];
      if (v === null || v === undefined) continue;
      const p = parseMoney(v);
      if (p > best) best = p;
    }
    if (best > 0) return best;
    return parseMoney(b);
  }

  const uid = body.uid || Date.now().toString(36);
  const fecha = body.fecha || new Date().toISOString().split('T')[0];
  const comercio = body.comercio || 'Compra';
  const monto = extractMoneyFromBody(body);
  const tarjeta = body.tarjeta || 'TC';
  const banco = body.banco || 'Santander';
  const emailId = body.emailId || '';
  const procesado = 'NO';

  const values = [[uid, fecha, comercio, monto, tarjeta, banco, emailId, procesado]];
  const range = 'Pendientes!A:H';
  const apiBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
  const payload = { range, majorDimension: 'ROWS', values };
  const dedupeRange = 'Pendientes!A2:A5000';

  try {
    const useServiceAccount = Boolean(serviceAccountEmail && serviceAccountPrivateKey);
    const authHeaders = useServiceAccount
      ? { Authorization: `Bearer ${await getGoogleAccessTokenFromServiceAccount(serviceAccountEmail, serviceAccountPrivateKey)}` }
      : {};
    const keyQuery = useServiceAccount ? '' : `?key=${encodeURIComponent(key)}`;
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
