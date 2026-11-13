// Pluie de confettis plein écran (≈ 3,5 s), sans bibliothèque.
// Ne fait rien si l'utilisateur a demandé à réduire les animations.
const COULEURS = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#0284C7', '#65A30D', '#F59E0B', '#EC4899'];

export function lancerConfettis(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = window.devicePixelRatio || 1;
  const L = window.innerWidth, H = window.innerHeight;
  const c = document.createElement('canvas');
  c.width = L * r; c.height = H * r;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '10000' });
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  if (!ctx) { c.remove(); return; }
  ctx.scale(r, r);
  const ps = Array.from({ length: 170 }, () => ({
    x: Math.random() * L, y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 3.5, vy: 2 + Math.random() * 3.5,
    a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.25,
    w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
    c: COULEURS[Math.floor(Math.random() * COULEURS.length)],
  }));
  const debut = performance.now();
  const image = (t: number) => {
    const ecoule = t - debut;
    ctx.clearRect(0, 0, L, H);
    ctx.globalAlpha = ecoule > 2800 ? Math.max(0, 1 - (ecoule - 2800) / 700) : 1;
    for (const p of ps) {
      p.vy += 0.045; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.a * 1.7)));
      ctx.restore();
    }
    if (ecoule < 3500) requestAnimationFrame(image); else c.remove();
  };
  requestAnimationFrame(image);
}
