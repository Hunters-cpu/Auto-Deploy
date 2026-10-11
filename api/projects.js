import { vercelFetch, json } from '../lib/vercel.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const data = await vercelFetch('/v9/projects?limit=100');
    return json(res, 200, { projects: (data.projects || []).map(p => ({ id: p.id, name: p.name, framework: p.framework, updatedAt: p.updatedAt, link: `https://${p.name}.vercel.app` })) });
  } catch (e) { return json(res, e.status || 500, { error: e.message }); }
}
