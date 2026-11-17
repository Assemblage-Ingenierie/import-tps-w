// Icône de Carnet pour l'écran d'accueil du téléphone : le « A » noir
// d'Assemblage avec « Carnet » juste en dessous, sur fond blanc.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// Inter SemiBold (police de Carnet) ; police par défaut si Google Fonts ne répond pas.
async function inter(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@600&text=Carnet')).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch { return null; }
}

export async function iconeCarnet(cote: number) {
  const police = await inter();
  const logo = await readFile(join(process.cwd(), 'public', 'logo-assemblage-noir.png'));
  const src = `data:image/png;base64,${logo.toString('base64')}`;
  const hLogo = Math.round(cote * 0.46);           // le logo fait 245 × 360 px
  const lLogo = Math.round((hLogo * 245) / 360);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={lLogo} height={hLogo} alt="" />
        <div style={{ marginTop: Math.round(cote * 0.035), fontSize: Math.round(cote * 0.17), fontFamily: police ? 'Inter' : undefined, fontWeight: 600, color: '#1F2430', letterSpacing: -0.5, lineHeight: 1 }}>
          Carnet
        </div>
      </div>
    ),
    { width: cote, height: cote, fonts: police ? [{ name: 'Inter', data: police, weight: 600, style: 'normal' }] : undefined },
  );
}
