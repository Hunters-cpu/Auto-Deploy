import Busboy from 'busboy';
import yauzl from 'yauzl';
import { createHash } from 'node:crypto';
import { vercelFetch, json, getVercelToken } from '../lib/vercel.js';

const MAX_ZIP_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_FILES = 100;
const validName = /^[a-z0-9][a-z0-9-]{0,99}$/;

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let upload;
    try { upload = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_ZIP_BYTES, fields: 3 } }); }
    catch { reject(Object.assign(new Error('Upload harus menggunakan form-data dengan file ZIP.'), { status: 400 })); return; }
    let name = '';
    let production = false;
    let fileSeen = false;
    upload.on('field', (key, value) => { if (key === 'name') name = value; if (key === 'production') production = value === 'true'; });
    upload.on('file', (field, stream, info) => {
      if (field !== 'file' || fileSeen) { stream.resume(); return; }
      fileSeen = true;
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => reject(Object.assign(new Error('File terlalu besar. Maksimal 15 MB.'), { status: 413 })));
      stream.on('end', () => { file = { buffer: Buffer.concat(chunks), filename: info.filename || 'project.zip' }; });
    });
    let file;
    upload.on('error', reject);
    upload.on('close', () => {
      if (!fileSeen || !file) return reject(Object.assign(new Error('Pilih file ZIP project terlebih dahulu.'), { status: 400 }));
      resolve({ name, production, file });
    });
    req.pipe(upload);
  });
}

function unzip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) return reject(Object.assign(new Error('ZIP tidak valid atau rusak.'), { status: 400 }));
      const files = [];
      let total = 0;
      let settled = false;
      const fail = (message, status = 400) => { if (settled) return; settled = true; zip.close(); reject(Object.assign(new Error(message), { status })); };
      zip.on('error', () => fail('Gagal membaca file ZIP.'));
      zip.on('entry', entry => {
        const raw = entry.fileName.replace(/\\/g, '/');
        if (raw.endsWith('/')) { zip.readEntry(); return; }
        if (raw.startsWith('/') || raw.split('/').some(part => part === '..') || raw.includes('\0')) return fail('ZIP berisi path file yang tidak aman.');
        if (entry.fileName.startsWith('__MACOSX/') || entry.fileName.endsWith('.DS_Store')) { zip.readEntry(); return; }
        if (files.length >= MAX_FILES) return fail(`Maksimal ${MAX_FILES} file per deployment.` , 413);
        if (entry.uncompressedSize > MAX_TOTAL_BYTES || total + entry.uncompressedSize > MAX_TOTAL_BYTES) return fail('Ukuran hasil ekstrak maksimal 30 MB.', 413);
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) return fail('Tidak dapat membaca salah satu file ZIP.');
          const chunks = [];
          stream.on('data', chunk => chunks.push(chunk));
          stream.on('error', () => fail('Gagal mengekstrak file ZIP.'));
          stream.on('end', () => {
            const data = Buffer.concat(chunks);
            total += data.length;
            files.push({ file: raw, data, sha: createHash('sha1').update(data).digest('hex') });
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => {
        if (settled) return;
        settled = true;
        if (!files.length) return reject(Object.assign(new Error('ZIP tidak berisi file yang bisa dideploy.'), { status: 400 }));
        const hasIndex = files.some(f => f.file === 'index.html' || f.file.endsWith('/index.html'));
        if (!hasIndex) return reject(Object.assign(new Error('File index.html tidak ditemukan. Untuk website statis, letakkan index.html di root ZIP.'), { status: 400 }));
        // Strip a single wrapper directory if all files live inside it.
        const roots = new Set(files.map(f => f.file.split('/')[0]));
        if (roots.size === 1 && files.every(f => f.file.includes('/'))) {
          const root = [...roots][0] + '/';
          for (const f of files) f.file = f.file.slice(root.length);
        }
        resolve(files);
      });
      zip.readEntry();
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const token = getVercelToken();
    if (!token) return json(res, 503, { error: 'Token belum diatur. Isi lib/private-config.js atau set VERCEL_TOKEN di Environment Variables.' });
    const { name: rawName, production, file } = await readMultipart(req);
    const name = String(rawName || '').trim().toLowerCase() || `upload-${Date.now().toString(36)}`;
    if (!validName.test(name)) return json(res, 400, { error: 'Nama URL harus huruf kecil, angka, atau tanda hubung (maksimal 100 karakter).' });
    if (!file.filename.toLowerCase().endsWith('.zip')) return json(res, 400, { error: 'Upload file .zip berisi website statis.' });
    if (!file.buffer.length) return json(res, 400, { error: 'File ZIP kosong.' });
    const files = await unzip(file.buffer);
    for (const item of files) {
      const response = await fetch('https://api.vercel.com/v2/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(item.data.length),
          'x-vercel-digest': item.sha
        },
        body: item.data
      });
      if (!response.ok) {
        const text = await response.text();
        let message = text; try { message = JSON.parse(text)?.error?.message || text; } catch {}
        const error = new Error(`Gagal mengunggah ${item.file} ke Vercel: ${message || response.status}`);
        error.status = response.status;
        throw error;
      }
    }
    const payload = {
      name,
      files: files.map(f => ({ file: f.file, sha: f.sha, size: f.data.length })),
      projectSettings: { framework: null },
      target: production ? 'production' : undefined
    };
    const deployment = await vercelFetch('/v13/deployments?skipAutoDetectionConfirmation=1&forceNew=1', { method: 'POST', body: JSON.stringify(payload) });
    return json(res, 200, {
      id: deployment.id || deployment.uid,
      url: deployment.url ? `https://${deployment.url}` : '',
      state: deployment.readyState || deployment.state || 'QUEUED',
      name: deployment.name || name,
      files: files.length
    });
  } catch (e) { return json(res, e.status || 500, { error: e.message || 'Deployment gagal.' }); }
}
