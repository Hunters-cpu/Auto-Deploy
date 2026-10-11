import { VERCEL_TOKEN as FILE_VERCEL_TOKEN } from './private-config.js';

export function getVercelToken() {
  // Environment variable lebih diprioritaskan; file backend jadi fallback praktis.
  return process.env.VERCEL_TOKEN || FILE_VERCEL_TOKEN || '';
}

export async function vercelFetch(path, options = {}) {
  const token = getVercelToken();
  if (!token) {
    const error = new Error('Token Vercel belum diatur. Isi lib/private-config.js atau set VERCEL_TOKEN di Environment Variables.');
    error.status = 503;
    throw error;
  }
  const url = new URL(`https://api.vercel.com${path}`);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Vercel API error (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(data));
}
