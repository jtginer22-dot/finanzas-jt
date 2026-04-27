'use strict';

const { getGoogleAccessTokenFromServiceAccount } = require('./lib/google-sheets-token');

/**
 * Proxy seguro para Google Sheets API v4.
 * - Lecturas (GET): pueden usar GOOGLE_SHEETS_API_KEY en la query (hojas públicas / restricciones de GCP).
 * - Escritura (append, put): Google no acepta API key; requiere cuenta de servicio
 *   (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY), igual que ingest-mobile.
 *
 * Opcional: SHEETS_ALLOWED_SPREADSHEET_IDS=id1,id2 — si está definido, solo esos IDs son aceptados.
 */

exports.handler = async (event) => {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  const allowListRaw = process.env.SHEETS_ALLOWED_SPREADSHEET_IDS || '';
  const requiredPasscode = process.env.APP_PASSCODE || '';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-passcode',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const useServiceAccount = Boolean(serviceAccountEmail && serviceAccountPrivateKey);

  if (!key && !useServiceAccount) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error:
          'Falta autenticación Google: define GOOGLE_SHEETS_API_KEY y/o cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).',
      }),
    };
  }

  const allowed = allowListRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const providedPasscode = event.headers['x-app-passcode'] || event.headers['X-App-Passcode'] || '';

  function isAllowed(id) {
    if (!id) return false;
    if (!allowed.length) return true;
    return allowed.includes(id);
  }

  if (requiredPasscode && providedPasscode !== requiredPasscode) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Passcode inválido o faltante' }),
    };
  }

  async function sheetsAuthHeaders() {
    if (!useServiceAccount) return {};
    const token = await getGoogleAccessTokenFromServiceAccount(serviceAccountEmail, serviceAccountPrivateKey);
    return { Authorization: `Bearer ${token}` };
  }

  function keyQueryParam() {
    if (useServiceAccount) return '';
    if (!key) return '';
    return `?key=${encodeURIComponent(key)}`;
  }

  try {
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      const spreadsheetId = q.spreadsheetId || q.sheetId;
      if (!spreadsheetId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta query param spreadsheetId' }) };
      }
      if (!isAllowed(spreadsheetId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'spreadsheetId no permitido' }) };
      }
      const range = q.range;
      if (!range) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta query param range' }) };
      }

      const kq = keyQueryParam();
      if (!useServiceAccount && !kq) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'GET requiere GOOGLE_SHEETS_API_KEY o cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_*).',
          }),
        };
      }

      const authHeaders = await sheetsAuthHeaders();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${kq}`;
      const r = await fetch(url, { headers: { ...authHeaders } });
      const text = await r.text();
      return { statusCode: r.status, headers, body: text };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Body JSON inválido' }) };
      }

      const spreadsheetId = body.spreadsheetId;
      if (!spreadsheetId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta spreadsheetId en el body' }) };
      }
      if (!isAllowed(spreadsheetId)) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'spreadsheetId no permitido' }) };
      }

      const operation = body.operation;
      const range = body.range;
      const values = body.values;
      const valueInputOption = body.valueInputOption || 'RAW';
      const majorDimension = body.majorDimension || 'ROWS';

      if (!range || values === undefined) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan range o values' }) };
      }

      if (!useServiceAccount) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error:
              'Escritura a Sheets (append/put) no admite API key. Configura en Netlify GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (mismo flujo que ingest-mobile) y comparte la hoja con el email de la cuenta de servicio.',
          }),
        };
      }

      const authHeaders = await sheetsAuthHeaders();

      if (operation === 'append') {
        const insertDataOption = body.insertDataOption || 'INSERT_ROWS';
        // El `range` del body debe coincidir con el de la URL; si no, Google responde 400
        // INVALID_ARGUMENT ("Request range does not match value's range"). Igual que ingest-mobile.
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=${encodeURIComponent(valueInputOption)}&insertDataOption=${encodeURIComponent(insertDataOption)}`;
        const payload = { range, majorDimension, values };
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        return { statusCode: r.status, headers, body: text };
      }

      if (operation === 'put') {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=${encodeURIComponent(valueInputOption)}`;
        const payload = { range, majorDimension, values };
        const r = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        return { statusCode: r.status, headers, body: text };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'operation debe ser append o put' }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
