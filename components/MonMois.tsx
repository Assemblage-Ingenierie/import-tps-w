'use client';
// « Mon mois » : tableau de bord concis au-dessus de la saisie.
//  · répartition du temps saisi par affaire (5 premières + autres), avec les
//    codes hors affaire regroupés et détaillés ;
//  · absences Payfit du mois ;
//  · points d'attention (saisie pendant une absence, sur une affaire
//    terminée, un jour non ouvré), affichés seulement s'il y en a.
// Calculé sur les données déjà chargées : aucun appel serveur.
import type { AffaireLite, Creneau, DonneesMois } from '@/lib/types';
import { estOuvre, frDateLong } from '@/lib/dates';
import { couleurAffaire } from './couleurs';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const pct = (v: number, t: number) => (t ? Math.round((100 * v) / t) : 0);
const GRIS_HORS = '#9aa3ab';
const GRIS_AUTRES = '#c5ccd3';

interface Segment { id: string; label: string; titre: string; jours: number; couleur: string }
interface Point { type: string; texte: string; date: string; creneau: Creneau }

export default function MonMois({ data, affParId, onAller, titre = 'Mon mois', couleur = couleurAffaire }: {
  data: DonneesMois;
  couleur?: (a: AffaireLite) => string;
  titre?: string;
  affParId: Map<string, AffaireLite>;
  onAller: (date: string, creneau: Creneau) => void;
}) {
  // Jours par affaire (un créneau = 0,5 j).
  const parAffaire = new Map<string, number>();
  for (const c of data.creneaux) if (c.affaireId) parAffaire.set(c.affaireId, (parAffaire.get(c.affaireId) || 0) + 0.5);
  const total = [...parAffaire.values()].reduce((s, v) => s + v, 0);

  const affaires: Segment[] = [];
  const hors: Segment[] = [];
  for (const [id, jours] of parAffaire) {
    const a = affParId.get(id);
    const seg = { id, label: a?.code || '?', titre: a ? `${a.code} — ${a.nom}` : 'Affaire inconnue', jours, couleur: a ? (a.horsAffaire ? couleurAffaire(a) : couleur(a)) : couleurAffaire(null) };
    (a?.horsAffaire ? hors : affaires).push(seg);
  }
  affaires.sort((x, y) => y.jours - x.jours);
  hors.sort((x, y) => y.jours - x.jours);
  const top = affaires.slice(0, 5);
  const reste = affaires.slice(5);
  const segments: Segment[] = [...top];
  if (reste.length) {
    segments.push({
      id: 'autres', label: `Autres affaires (${reste.length})`, couleur: GRIS_AUTRES,
      titre: reste.map(s => `${s.label} ${nb(s.jours)} j`).join(' · '),
      jours: reste.reduce((s, x) => s + x.jours, 0),
    });
  }
  const joursHors = hors.reduce((s, x) => s + x.jours, 0);
  if (joursHors) {
    segments.push({
      id: 'hors', label: 'Hors affaire', couleur: GRIS_HORS,
      titre: hors.map(s => `${s.label} ${nb(s.jours)} j`).join(' · '), jours: joursHors,
    });
  }

  // Absences Payfit sur les jours ouvrés du mois.
  const demiAbsences = data.jours.filter(j => estOuvre(j.date)).reduce((s, j) => s + (j.absence.AM ? 1 : 0) + (j.absence.PM ? 1 : 0), 0);

  // Points d'attention.
  const points: Point[] = [];
  for (const c of data.conflits) points.push({ type: 'err', texte: 'Temps saisi pendant une absence Payfit', date: c.date, creneau: c.creneau });
  for (const c of data.creneaux) {
    if (!c.affaireId) continue;
    if (affParId.get(c.affaireId)?.clos) points.push({ type: 'warn', texte: `Affaire terminée (${affParId.get(c.affaireId)?.code})`, date: c.date, creneau: c.creneau });
    if (!estOuvre(c.date)) points.push({ type: 'info', texte: 'Saisie un jour non ouvré', date: c.date, creneau: c.creneau });
  }
  const groupes = new Map<string, Point[]>();
  for (const p of points.sort((a, b) => (a.date + a.creneau).localeCompare(b.date + b.creneau))) {
    const cle = p.texte.startsWith('Affaire terminée') ? 'Affaire terminée' : p.texte;
    groupes.set(cle, [...(groupes.get(cle) || []), p]);
  }

  return (
    <section className="mon-mois" aria-label={titre}>
      <div className="mm-tete">
        <h2>{titre}</h2>
        <span className="mm-chiffre"><strong>{nb(total)} j</strong> saisis</span>
        <span className="mm-chiffre" title="Absences validées dans Payfit, jours ouvrés">
          {!data.absencesDisponibles ? 'Absences Payfit indisponibles'
            : demiAbsences ? <><strong>{nb(demiAbsences / 2)} j</strong> d&apos;absence (Payfit)</>
            : 'Aucune absence'}
        </span>
      </div>

      {total === 0 ? <p className="discret">Aucun temps saisi ce mois-ci.</p> : <>
        <div className="mm-barre" role="img" aria-label={segments.map(s => `${s.label} ${pct(s.jours, total)} %`).join(', ')}>
          {segments.map(s => (
            <span key={s.id} style={{ width: `${(100 * s.jours) / total}%`, background: s.couleur }} title={`${s.titre} — ${nb(s.jours)} j (${pct(s.jours, total)} %)`} />
          ))}
        </div>
        <ul className="mm-legende">
          {segments.map(s => (
            <li key={s.id} title={s.titre}>
              <span className="pastille" style={{ background: s.couleur }} />
              <span className="mm-lib">{s.label}</span> <strong>{pct(s.jours, total)} %</strong>
              {s.id === 'hors' && hors.length > 0 && (
                <span className="mm-detail"> ({hors.map(h => `${h.label} ${pct(h.jours, total)} %`).join(', ')})</span>
              )}
            </li>
          ))}
        </ul>
      </>}

      {groupes.size > 0 && (
        <ul className="mm-attention">
          {[...groupes].map(([texte, ps]) => (
            <li key={texte} className={ps[0].type}>
              <span>{texte} : {ps.length} créneau{ps.length > 1 ? 'x' : ''}</span>
              <button className="lien" onClick={() => onAller(ps[0].date, ps[0].creneau)}>
                voir le {frDateLong(ps[0].date).split(' ').slice(1, 3).join(' ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
