// Organisations du CRM pour la fenêtre « Créer une affaire ».
import { exigerUtilisateur, gerer, json } from '@/lib/auth';
import { organisations } from '@/lib/crm';

export async function GET() {
  return gerer(async () => {
    await exigerUtilisateur();
    return json({ organisations: await organisations() });
  });
}
