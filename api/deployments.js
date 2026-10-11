import { vercelFetch, json } from '../lib/vercel.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const q = new URL(req.url, 'http://localhost').searchParams;
    const params = new URLSearchParams({ limit: '20' });
    const projectId = q.get('projectId');
    if (projectId) params.set('projectId', projectId);
    const data = await vercelFetch(`/v6/deployments?${params.toString()}`);
    return json(res, 200, { deployments: (data.deployments || []).map(d => ({ id: d.uid || d.id, name: d.name, url: d.url ? `https://${d.url}` : '', state: d.state || d.readyState || 'UNKNOWN', createdAt: d.createdAt, target: d.target })) });
  } catch (e) { return json(res, e.status || 500, { error: e.message }); }
}
