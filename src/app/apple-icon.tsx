import { ImageResponse } from 'next/og';

// Générée à la demande (puis mise en cache) : évite le pré-rendu, qui échoue sous Windows
// quand le chemin du projet contient des espaces
export const runtime = 'edge';

// Icône pour l'écran d'accueil iPhone / iPad (180 × 180)
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const Tile = ({ opacity = 1 }: { opacity?: number }) => (
  <div style={{ width: 50, height: 50, borderRadius: 10, background: '#fff', opacity }} />
);

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#E8671A',
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 34,
      }}
    >
      <Tile />
      <Tile opacity={0.65} />
      <Tile opacity={0.65} />
      <Tile />
    </div>,
    size,
  );
}
