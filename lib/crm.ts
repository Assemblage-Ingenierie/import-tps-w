// Organisations du CRM (table « Sync CRM », synchronisée depuis la base CRM),
// proposées pour les champs Architecte / Maître d'ouvrage / BET / Entreprise.
import { CRM } from './config';
import { lister, memo, texte, liste } from './airtable';
import type { Organisation } from './options-affaire';

export function organisations(): Promise<Organisation[]> {
  return memo('ref:crm', 10 * 60 * 1000, async () => {
    const recs = await lister(CRM.table, { fields: [CRM.f.nom, CRM.f.role] });
    return recs
      .map(r => ({ id: r.id, nom: texte(r.fields[CRM.f.nom]).trim(), roles: liste(r.fields[CRM.f.role]) }))
      .filter(o => o.nom)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });
}
