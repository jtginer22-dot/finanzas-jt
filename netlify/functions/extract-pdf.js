/**
 * extract-pdf — desencripta y extrae texto de PDFs de Santander
 *
 * POST /api/extract-pdf
 * Body: { pdfBase64: string, password: string }
 * Returns: { text: string, pages: number }
 *
 * Usado por Apps Script para procesar el Estado de Cuenta y Cartola
 * Mensual de Santander, cuyos PDFs llegan encriptados con el RUT del cliente.
 */

const { getDocument, GlobalWorkerOptions } = require('pdfjs-dist/legacy/build/pdf.js');
GlobalWorkerOptions.workerSrc = false;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { pdfBase64, password } = body;

  if (!pdfBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'pdfBase64 requerido' }) };
  }

  try {
    const pdfBytes = Buffer.from(pdfBase64, 'base64');

    const loadingTask = getDocument({
      data: new Uint8Array(pdfBytes),
      password: password || '',
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s{3,}/g, '\n');
      fullText += pageText + '\n';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: fullText, pages: numPages }),
    };
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('password') || msg.includes('encrypted') || msg.includes('PasswordException')) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({ error: 'pdf_password_incorrecta', detail: msg }),
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'pdf_error', detail: msg }),
    };
  }
};
