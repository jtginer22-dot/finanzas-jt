'use strict';

/**
 * Proxy seguro para Google Sheets API v4.
 * La API key solo existe como GOOGLE_SHEETS_API_KEY en Netlify (Site settings → Environment variables).
 *
 * Opcional: SHEETS_ALLOWED_SPREADSHEET_IDS=id1,id2 — si está definido, solo esos IDs son aceptados.
 */

exports.handler = async (event) => {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  const allowListRaw = process.env.SHEETS_ALLOWED_SPREADSHEET_IDS || '';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!key) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Falta GOOGLE_SHEETS_API_KEY en variables de entorno de Netlify.',
      }),
    };
  }

  const allowed = allowListRaw.split(',').map((s) => s.trim()).filter(Boolean);

  function isAllowed(id) {
    if (!id) return false;
    if (!allowed.length) return true;
    return allowed.includes(id);
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

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(key)}`;
      const r = await fetch(url);
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

      if (operation === 'append') {
        const insertDataOption = body.insertDataOption || 'INSERT_ROWS';
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=${encodeURIComponent(valueInputOption)}&insertDataOption=${encodeURIComponent(insertDataOption)}&key=${encodeURIComponent(key)}`;
        const sheetName = range.includes('!') ? range.split('!')[0] : range;
        const innerRange = body.appendAnchor || `${sheetName}!A1`;
        const payload = { range: innerRange, majorDimension, values };
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await r.text();
        return { statusCode: r.status, headers, body: text };
      }

      if (operation === 'put') {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=${encodeURIComponent(valueInputOption)}&key=${encodeURIComponent(key)}`;
        const payload = { range, majorDimension, values };
        const r = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
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
