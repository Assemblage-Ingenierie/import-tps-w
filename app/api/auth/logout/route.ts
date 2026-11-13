import { NextResponse } from 'next/server';
import { enteteCookie } from '@/lib/session';

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 302);
  res.headers.set('Set-Cookie', enteteCookie('', 0));
  return res;
}
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', enteteCookie('', 0));
  return res;
}
