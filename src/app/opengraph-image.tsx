import { ImageResponse } from 'next/og';

// Générée à la demande (puis mise en cache) : évite le pré-rendu, qui échoue sous Windows
// quand le chemin du projet contient des espaces
export const runtime = 'edge';

// Aperçu affiché quand le site est partagé (WhatsApp, LinkedIn, Facebook, X…)
export const alt = 'CaléPlan — calepinage carrelage en ligne : plan, pose et quantitatif';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const Logo = ({ s }: { s: number }) => (
  <div
    style={{
      width: s,
      height: s,
      borderRadius: s * 0.22,
      background: '#E8671A',
      display: 'flex',
      flexWrap: 'wrap',
      alignContent: 'center',
      justifyContent: 'center',
      gap: s * 0.07,
      padding: s * 0.19,
    }}
  >
    {[1, 0.65, 0.65, 1].map((o, i) => (
      <div
        key={i}
        style={{
          width: s * 0.27,
          height: s * 0.27,
          borderRadius: s * 0.06,
          background: '#fff',
          opacity: o,
        }}
      />
    ))}
  </div>
);

export default function OpengraphImage() {
  // Petit calepinage décoratif : grille de carreaux, quelques coupes en orange
  const tiles = Array.from({ length: 6 * 5 }, (_, i) => i);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#08090C',
        padding: 72,
        color: '#E6EDF3',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo s={64} />
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
            Calé<span style={{ color: '#E8671A' }}>Plan</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 60,
            lineHeight: 1.12,
            fontWeight: 700,
          }}
        >
          Calepinage carrelage en ligne
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 30,
            lineHeight: 1.4,
            color: 'rgba(230,237,243,0.7)',
          }}
        >
          Tracez la pièce, simulez la pose, obtenez le nombre exact de carreaux et de cartons.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            alignSelf: 'flex-start',
            padding: '14px 26px',
            borderRadius: 14,
            background: '#E8671A',
            fontSize: 28,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          Gratuit · www.caleplan.com
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'center',
          width: 6 * 64 + 5 * 6,
          gap: 6,
          marginLeft: 'auto',
          marginTop: 40,
        }}
      >
        {tiles.map((i) => {
          const cut = i % 6 === 5 || i >= 24;
          return (
            <div
              key={i}
              style={{
                width: 64,
                height: 64,
                borderRadius: 4,
                background: cut ? 'rgba(232,103,26,0.45)' : '#232a33',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
          );
        })}
      </div>
    </div>,
    size,
  );
}
