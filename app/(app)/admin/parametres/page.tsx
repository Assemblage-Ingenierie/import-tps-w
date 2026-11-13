'use client';
import { useEffect, useState } from 'react';

export default function PageParametres() {
  const [d, setD] = useState<{ balanceVisibleUsers: boolean; admins: string[]; env: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    fetch('/api/admin/parametres').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.erreur); setD(j); }).catch(e => setErr(e.message));
  }, []);

  async function basculer(v: boolean) {
    setEnCours(true); setErr(null);
    try {
      const r = await fetch('/api/admin/parametres', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balanceVisibleUsers: v }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur);
      setD(x => (x ? { ...x, balanceVisibleUsers: j.balanceVisibleUsers } : x));
    } catch (e) { setErr((e as Error).message); } finally { setEnCours(false); }
  }

  return (
    <div>
      <h1>Paramètres</h1>
      {err && <div className="bandeau err">{err}</div>}
      {!d && !err && <div className="chargement">Chargement…</div>}
      {d && <>
        <div className="carte">
          <label className="interrupteur">
            <input type="checkbox" checked={d.balanceVisibleUsers} disabled={enCours} onChange={e => basculer(e.target.checked)} />
            <span><strong>Balance visible par les Users</strong><br />
              <small>Désactivé par défaut. Tant qu&apos;il est désactivé, aucune donnée de balance n&apos;est envoyée au navigateur d&apos;un User. Activé, chaque User voit la balance de ses affaires dans « Mes affaires ».</small></span>
          </label>
        </div>
        <div className="carte">
          <strong>Administrateurs</strong>
          <p className="discret">Définis par la variable d&apos;environnement Vercel <code>ADMIN_EMAILS</code>. Tout autre compte @assemblage.net a le rôle User.</p>
          <ul>{d.admins.map(a => <li key={a}>{a}</li>)}</ul>
        </div>
        <div className="carte">
          <strong>Environnement</strong>
          <p className="discret">{d.env === 'production' ? 'Production : les saisies sont écrites dans « Temps W ».' : 'Test : les saisies sont écrites dans « Temps W TEST ». Bascule par la variable TPSW_ENV=production.'}</p>
        </div>
      </>}
    </div>
  );
}
