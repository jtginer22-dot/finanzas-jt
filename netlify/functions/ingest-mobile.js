'use strict';
const crypto = require('crypto');

/**
 * Ingesta segura de movimientos móviles (Shortcut/Scriptable).
 * Requiere APP_PASSCODE y usa GOOGLE_SHEETS_API_KEY del servidor.
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
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    const raw = String(input ?? '').trim();
    if (!raw) return 0;
    // Conserva solo dígitos y separadores decimales comunes.
    const cleaned = raw.replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');
    let normalized = cleaned;
    if (hasDot && hasComma) {
      // Caso típico LATAM: 64.130,00 -> 64130.00
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma && !hasDot) {
      // 1234,56 -> 1234.56
      normalized = cleaned.replace(',', '.');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  const uid = body.uid || Date.now().toString(36);
  const fecha = body.fecha || new Date().toISOString().split('T')[0];
  const comercio = body.comercio || 'Compra';
  const monto = parseMoney(body.monto);
  const tarjeta = body.tarjeta || 'TC';
  const banco = body.banco || 'Santander';
  const emailId = body.emailId || '';
  const procesado = 'NO';

  const values = [[uid, fecha, comercio, monto, tarjeta, banco, emailId, procesado]];
  const range = 'Pendientes!A:H';
  const apiBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
  const payload = { range, majorDimension: 'ROWS', values };
  const dedupeRange = 'Pendientes!A2:A5000';

  function base64url(input) {
    return Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async function getGoogleAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(unsigned)
      .sign(serviceAccountPrivateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const assertion = `${unsigned}.${signature}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    const tokenText = await tokenRes.text();
    let tokenJson;
    try { tokenJson = JSON.parse(tokenText); } catch { tokenJson = null; }
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || tokenText || 'No se pudo obtener access token de Google');
    }
    return tokenJson.access_token;
  }

  try {
    const useServiceAccount = Boolean(serviceAccountEmail && serviceAccountPrivateKey);
    const authHeaders = useServiceAccount
      ? { Authorization: `Bearer ${await getGoogleAccessToken()}` }
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
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: 'OK', uid }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
