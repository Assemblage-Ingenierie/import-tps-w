// Icône d'écran d'accueil iPhone (180 × 180) : « A » noir + « Carnet ».
import { iconeCarnet } from './icone-carnet';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return iconeCarnet(180);
}
