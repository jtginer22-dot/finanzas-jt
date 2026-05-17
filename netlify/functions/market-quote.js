'use strict';

/**
 * Cotización de referencia vía Yahoo Finance chart API (sin API key).
 * Uso personal; Yahoo puede limitar o cambiar el endpoint.
 */
exports.handler = async (event) => {
  const requiredPasscode = process.env.APP_PASSCODE || '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-passcode',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
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

  const tickers = Array.isArray(body.tickers)
    ? body.tickers.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 30)
    : [];
  if (!tickers.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta tickers[]' }) };
  }

  const ua = { 'User-Agent': 'FinanzasJT/1.0 (personal; referencia de mercado)' };
  const prices = {};

  for (const sym of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const r = await fetch(url, { headers: ua });
      const text = await r.text();
      if (!r.ok) {
        prices[sym] = { error: `HTTP ${r.status}` };
        continue;
      }
      const j = JSON.parse(text);
      const res = j?.chart?.result?.[0];
      if (!res) {
        prices[sym] = { error: 'sin datos' };
        continue;
      }
      const meta = res.meta || {};
      const currency = meta.currency || '';
      let price = Number(meta.regularMarketPrice);
      if (!Number.isFinite(price)) {
        const closes = res?.indicators?.quote?.[0]?.close;
        if (Array.isArray(closes)) {
          for (let i = closes.length - 1; i >= 0; i--) {
            if (closes[i] != null && Number.isFinite(Number(closes[i]))) {
              price = Number(closes[i]);
              break;
            }
          }
        }
      }
      prices[sym] = {
        price: Number.isFinite(price) ? price : null,
        currency: currency || null,
      };
    } catch (err) {
      prices[sym] = { error: err.message || String(err) };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      prices,
      source: 'yahoo_chart',
      disclaimer: 'Solo referencia; no es asesoría de inversiones.',
    }),
  };
};
