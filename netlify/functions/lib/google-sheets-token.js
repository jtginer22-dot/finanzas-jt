'use strict';

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * OAuth2 access token (JWT bearer) for Google Sheets API using a service account.
 * @param {string} serviceAccountEmail
 * @param {string} serviceAccountPrivateKey PEM with literal \n or real newlines
 */
async function getGoogleAccessTokenFromServiceAccount(serviceAccountEmail, serviceAccountPrivateKey) {
  const key = serviceAccountPrivateKey.replace(/\\n/g, '\n');
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
    .sign(key, 'base64')
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
  try {
    tokenJson = JSON.parse(tokenText);
  } catch {
    tokenJson = null;
  }
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.error_description || tokenJson?.error || tokenText || 'No se pudo obtener access token de Google');
  }
  return tokenJson.access_token;
}

module.exports = { getGoogleAccessTokenFromServiceAccount };
