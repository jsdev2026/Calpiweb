'use client';
import type { Project } from '@/types/project';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { formatCm, formatM2 } from '@/utils/formatters';
import { QuantityPlanSvg } from './QuantityPlanSvg';
import { GROUP_COLORS } from './CutGroupCard';

// ── Sous-composant StatCard (hissé hors de QuantitiesPrintView pour éviter les recréations) ──
interface StatCardProps {
  label: string;
  value: number;
  color: string;
  borderColor: string;
  bg: string;
}

const StatCard = ({ label, value, color, borderColor, bg }: StatCardProps) => (
  <div style={{ border: `1px solid ${borderColor}`, background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1.1, fontFamily: 'system-ui' }}>{value}</div>
    <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginTop: 3 }}>{label}</div>
  </div>
);

// ── Logo CaléPlan SVG ──
const CalePlanLogo = ({ size = 20, opacity = 1 }: { size?: number; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ opacity, flexShrink: 0 }}>
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="#f97316" />
    <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="#f97316" fillOpacity=".7" />
    <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="#f97316" fillOpacity=".7" />
    <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="#f97316" />
  </svg>
);

const LAYOUT_LABELS: Record<string, string> = {
  STRAIGHT: 'Pose droite',
  HERRINGBONE: 'Bâton rompu',
  CHEVRON: 'Chevron',
};

export interface QuantitiesPrintViewProps {
  project: Project;
}

export const QuantitiesPrintView = ({ project }: QuantitiesPrintViewProps) => {
  const { config, wallThickness, rooms, client, name, description } = project;

  const generatedDate = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const validRooms = rooms.filter((r) => r.points.length >= 3);

  const roomResults = validRooms
    .map((room) => ({
      room,
      result: analyzeQuantities([room], config, wallThickness),
    }))
    .filter(({ result }) => result.totalTiles > 0);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827', background: '#fff' }}>

      {/* ① En-tête CaléPlan */}
      <div style={{ background: '#f97316', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <CalePlanLogo size={24} />
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.2px' }}>CaléPlan</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Quantitatif de calepinage</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{name}</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Généré le {generatedDate}</div>
        </div>
      </div>

      {/* ② Infos client (omis si absent) */}
      {client && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 32, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
              Client
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{client.name}</div>
            {client.phone && <div style={{ fontSize: 11, color: '#6b7280' }}>{client.phone}</div>}
            {client.email && <div style={{ fontSize: 11, color: '#6b7280' }}>{client.email}</div>}
          </div>
          {client.address && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                Adresse
              </div>
              <div style={{ fontSize: 11, color: '#374151', whiteSpace: 'pre-line' as const }}>{client.address}</div>
            </div>
          )}
          {description && (
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                Description
              </div>
              <div style={{ fontSize: 11, color: '#374151', fontStyle: 'italic' as const }}>{description}</div>
            </div>
          )}
        </div>
      )}

      {/* ③→⑥ Sections par pièce */}
      {roomResults.map(({ room, result }, idx) => (
        <div key={room.id} style={{ marginTop: idx > 0 ? 16 : 0 }}>

          {/* ③ En-tête pièce */}
          <div style={{
            background: '#f8fafc',
            borderTop: '2px solid #e2e8f0',
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap' as const,
            gap: 8,
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
              {room.name ?? `Pièce ${idx + 1}`}
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' as const }}>
              <span style={{ fontWeight: 600, color: '#f97316' }}>
                {formatCm(result.tileW)} × {formatCm(result.tileH)}
              </span>
              <span style={{ color: '#6b7280' }}>Joint {result.joint} mm</span>
              <span style={{ color: '#6b7280' }}>{LAYOUT_LABELS[config.layout] ?? config.layout}</span>
              <span style={{ color: '#6b7280' }}>{formatM2(result.roomArea)}</span>
            </div>
          </div>

          {/* ④ Plan SVG annoté */}
          <div style={{ padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <QuantityPlanSvg
              result={result}
              config={config}
              rooms={[room]}
              printMode={true}
              style={{ width: '100%', height: 'auto', maxHeight: 280 }}
              className=""
            />
            {/* Légende */}
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 12, background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>Carreaux entiers</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 12, background: '#fed7aa', border: '1px solid #f97316', borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>Coupes</span>
              </div>
            </div>
          </div>

          {/* ⑤ Statistiques */}
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <StatCard label="Total posés"       value={result.totalTiles}    color="#374151" borderColor="#e5e7eb" bg="#fff" />
            <StatCard label="Carreaux entiers"  value={result.wholeCount}    color="#3b82f6" borderColor="#dbeafe" bg="#eff6ff" />
            <StatCard label="Coupes"            value={result.cuts.length}   color="#f97316" borderColor="#fed7aa" bg="#fff7ed" />
            <StatCard label="À commander"       value={result.toOrder}       color="#16a34a" borderColor="#bbf7d0" bg="#f0fdf4" />
          </div>

          {/* ⑥ Tableau des coupes */}
          {result.cutGroups.length > 0 && (
            <div style={{ padding: '12px 24px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8 }}>
                Détail des groupes de coupes
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Couleur', 'Dimension', 'Qté', 'Chute récupérable', 'Carreaux source'].map((h) => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Qté' || h === 'Carreaux source' ? 'center' as const : 'left' as const, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.cutGroups.map((group, i) => {
                    const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
                    const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
                    const rowKey = `${group.usedW}×${group.usedH}|${group.pieceEdges.left}|${group.pieceEdges.right}`;
                    return (
                      <tr key={rowKey} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: '#111827' }}>
                          {formatCm(group.usedW)} × {formatCm(group.usedH)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' as const, fontWeight: 700, color: '#111827' }}>
                          ×{group.netTiles}
                        </td>
                        <td style={{ padding: '6px 8px', color: hasBigChute ? '#6b7280' : '#9ca3af', fontStyle: hasBigChute ? 'normal' as const : 'italic' as const }}>
                          {hasBigChute ? `${formatCm(group.chuteW)} × ${formatCm(group.chuteH)}` : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' as const, fontWeight: 600, color: '#f97316' }}>
                          {group.netTiles}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* ⑦ Footer filigrane */}
      <div style={{ marginTop: 24, background: '#f8fafc', borderTop: '2px solid #e2e8f0', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalePlanLogo size={14} opacity={0.4} />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>
            Document généré par CaléPlan — Outil professionnel de calepinage
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#d1d5db' }}>{generatedDate}</span>
      </div>
    </div>
  );
};
