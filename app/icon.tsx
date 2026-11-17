// Icône de l'application (onglet, écran d'accueil Android) : « A » noir + « Carnet ».
import { iconeCarnet } from './icone-carnet';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return iconeCarnet(512);
}
