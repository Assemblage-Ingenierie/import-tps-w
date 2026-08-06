import { enteteCookie } from '../_session.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', enteteCookie('', 0));
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.writeHead(302, { Location: '/login' });
  res.end();
}
