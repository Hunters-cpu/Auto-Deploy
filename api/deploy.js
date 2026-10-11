import { vercelFetch, json } from '../lib/vercel.js';
const validName = /^[a-z0-9][a-z0-9-]{0,99}$/;
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim().toLowerCase();
    const repo = String(body.repo || '').trim();
    const ref = String(body.ref || 'main').trim();
    const projectId = String(body.projectId || '').trim();
    if (!validName.test(name)) return json(res, 400, { error: 'Nama project harus berupa huruf kecil, angka, dan tanda hubung; maksimal 100 karakter.' });
    if (!/^[A-Za-z0-9_.-]{1,200}$/.test(ref)) return json(res, 400, { error: 'Nama branch tidak valid.' });
    if (!repo && !projectId) return json(res, 400, { error: 'Masukkan GitHub repo (owner/repo) atau pilih Project ID yang sudah ada.' });
    const payload = { name, target: body.production === true ? 'production' : undefined };
    if (projectId) payload.project = projectId;
    if (repo) {
      const cleanRepo = repo.replace(/^https:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) return json(res, 400, { error: 'Repo harus berformat owner/repo atau URL GitHub.' });
      const githubResponse = await fetch(`https://api.github.com/repos/${cleanRepo}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'deploy-to-vercel-dashboard' } });
      if (!githubResponse.ok) return json(res, 400, { error: 'Repository GitHub tidak ditemukan atau private. Untuk repo private, hubungkan GitHub ke Vercel dan gunakan repo yang sudah diotorisasi.' });
      const githubRepo = await githubResponse.json();
      payload.gitSource = { type: 'github', repoId: String(githubRepo.id), ref };
    }
    const data = await vercelFetch('/v13/deployments?skipAutoDetectionConfirmation=1', { method: 'POST', body: JSON.stringify(payload) });
    return json(res, 200, { id: data.id || data.uid, url: data.url ? `https://${data.url}` : '', state: data.readyState || data.state || 'QUEUED', name: data.name });
  } catch (e) { return json(res, e.status || 500, { error: e.message }); }
}
