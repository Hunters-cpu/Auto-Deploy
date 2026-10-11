import { vercelFetch, json } from '../lib/vercel.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const data = await vercelFetch('/v2/user');
    return json(res, 200, { id: data.user?.id, username: data.user?.username, email: data.user?.email, name: data.user?.name });
  } catch (e) { return json(res, e.status || 500, { error: e.message }); }
}
