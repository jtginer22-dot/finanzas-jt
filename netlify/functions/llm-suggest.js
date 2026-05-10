'use strict';

/**
 * Sugerencia de categorización con Anthropic (Claude API).
 * Solo propone; la confirmación final siempre la hace el usuario en la app.
 */
exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
  const requiredPasscode = process.env.APP_PASSCODE || '';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-passcode',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Falta ANTHROPIC_API_KEY en Netlify.' }) };

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

  const categories = Array.isArray(body.categories) ? body.categories.filter(Boolean) : [];
  const knownTags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
  const recentExamples = Array.isArray(body.recentExamples) ? body.recentExamples.slice(0, 12) : [];
  const text = String(body.text || '').trim();
  const amount = Number(body.amount || 0);
  const date = String(body.date || '');
  if (!text || !categories.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan text o categories[]' }) };
  }

  const systemPrompt = [
    'Eres un clasificador de gastos personales en Chile.',
    'Debes responder SOLO JSON válido, sin markdown, sin texto extra.',
    'Formato exacto: {"category":"...","tag":"etiqueta1, etiqueta2","reason":"...","confidence":0-1,"proposed_new_category":"..."}',
    'Usa category solo desde la lista permitida que te entregan.',
    'tag puede ser UNA o VARIAS etiquetas separadas por coma (máx. 4 etiquetas, nombres cortos).',
    'Si hay known_tags, prioriza reutilizar esas etiquetas cuando encajen; si no, inventa etiquetas cortas nuevas.',
    'Si el payload incluye recent_user_examples (decisiones recientes del usuario), úsalas como guía fuerte para imitar estilo cuando el comercio o el contexto sea parecido; no contradigas la lista de categorías permitidas.',
    'proposed_new_category es opcional y solo si detectas una categoría faltante (1-3 palabras).',
    'confidence entre 0 y 1.',
  ].join(' ');

  const userPrompt = JSON.stringify({
    transaction: { text, amount, date },
    allowed_categories: categories,
    known_tags: knownTags,
    recent_user_examples: recentExamples,
  });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 220,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      let msg = raw.slice(0, 800);
      try {
        const errJ = JSON.parse(raw);
        if (typeof errJ.error === 'string') msg = errJ.error;
        else if (errJ.error && typeof errJ.error.message === 'string') msg = errJ.error.message;
        else if (typeof errJ.message === 'string') msg = errJ.message;
      } catch (_) { /* raw ya es texto */ }
      return {
        statusCode: r.status >= 400 && r.status < 600 ? r.status : 502,
        headers,
        body: JSON.stringify({ error: msg || 'Error desde Anthropic' }),
      };
    }

    let outer;
    try { outer = JSON.parse(raw); } catch { return { statusCode: 502, headers, body: JSON.stringify({ error: 'Respuesta no JSON desde Anthropic' }) }; }
    const textBlock = (outer.content || []).find(c => c.type === 'text')?.text || '';
    const jsonStart = textBlock.indexOf('{');
    const jsonEnd = textBlock.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd < 0) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'No se pudo extraer JSON de la respuesta LLM' }) };
    }
    const candidate = textBlock.slice(jsonStart, jsonEnd + 1);
    let parsed;
    try { parsed = JSON.parse(candidate); } catch { return { statusCode: 502, headers, body: JSON.stringify({ error: 'JSON inválido desde LLM' }) }; }

    const category = categories.includes(parsed.category) ? parsed.category : categories[0];
    const tag = String(parsed.tag || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(', ')
      .slice(0, 120);
    const reason = String(parsed.reason || '').slice(0, 220);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0.5)));
    const proposedNewCategory = String(parsed.proposed_new_category || '').trim().slice(0, 64);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ category, tag, reason, confidence, proposedNewCategory, provider: 'anthropic', model }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || String(err) }) };
  }

};
