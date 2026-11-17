// Icône de l'application (onglet, écran d'accueil Android) : « C » blanc sur indigo.
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4F46E5', color: '#fff', fontSize: 320, fontWeight: 700, fontFamily: 'sans-serif' }}>
        C
      </div>
    ),
    size,
  );
}
