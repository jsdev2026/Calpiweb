'use client';
// PDF du quantitatif (impression A4) : page de synthèse puis une page par pièce.
// Noir et gris pour la lisibilité, touches d'orange et logo CaléPlan.
import type { Project, Room } from '@/types/project';
import type { DoorOpening } from '@/types/wall';
import { computeCornerGeometry, computeNodeCaps } from '@/engine/geometry/wallGeometry';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { computeStartTiles, formatCote } from '@/engine/tiling/startTile';
import { QuantityPrintPlan } from './QuantityPrintPlan';
import { PRINT } from './printTheme';
import {
  cutNumbers,
  documentRef,
  poseLabel,
  printCm,
  printM2,
  printNb,
  wallName,
} from './printHelpers';

/** Coordonnées de l'entreprise de l'utilisateur, imprimées en tête du PDF (Paramètres → Entreprise). */
export interface PrintCompany {
  name: string | null;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
}

export interface QuantitiesPrintViewProps {
  project: Project;
  rooms?: Room[]; // remplace project.rooms (ex. pièces issues du moteur de murs)
  doorOpenings?: DoorOpening[];
  company?: PrintCompany | null;
  /** Date d'édition (tests) */
  now?: Date;
}

const { ink, text, muted, rule, hair, brand, brandLight, serif, sans } = PRINT;

// ── Marque ──────────────────────────────────────────────────────────────────
const Logo = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden
    style={{ flexShrink: 0, display: 'block' }}
  >
    <rect width="16" height="16" rx="3.6" fill={brand} />
    <rect x="3" y="3" width="4.4" height="4.4" rx="0.9" fill="#fff" />
    <rect x="8.6" y="3" width="4.4" height="4.4" rx="0.9" fill="#fff" fillOpacity=".65" />
    <rect x="3" y="8.6" width="4.4" height="4.4" rx="0.9" fill="#fff" fillOpacity=".65" />
    <rect x="8.6" y="8.6" width="4.4" height="4.4" rx="0.9" fill="#fff" />
  </svg>
);

const Brand = ({ size = 18, font = 12 }: { size?: number; font?: number }) => (
  <span
    data-testid="print-brand"
    aria-label="CaléPlan"
    style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.38 }}
  >
    <Logo size={size} />
    <span style={{ fontWeight: 700, fontSize: font, color: ink, letterSpacing: '-0.01em' }}>
      Calé<span style={{ color: brand }}>Plan</span>
    </span>
  </span>
);

// ── Typographie ─────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 7.5,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: muted,
      marginBottom: 3,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ n, children }: { n?: number; children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderBottom: `1px solid ${ink}`,
      paddingBottom: 4,
      marginBottom: 8,
      marginTop: 18,
      breakAfter: 'avoid',
    }}
  >
    {n !== undefined && (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 15,
          height: 15,
          borderRadius: 4,
          background: brand,
          color: '#fff',
          fontSize: 8.5,
          fontWeight: 700,
        }}
      >
        {n}
      </span>
    )}
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: ink }}>
      {children}
    </span>
  </div>
);

/** Double filet sous les titres : court en orange, puis noir */
const TitleRule = ({ height = 3, accent = 64 }: { height?: number; accent?: number }) => (
  <div style={{ display: 'flex' }}>
    <div style={{ height, width: accent, background: brand }} />
    <div style={{ height, flex: 1, background: ink }} />
  </div>
);

const th: React.CSSProperties = {
  fontSize: 7.5,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: muted,
  textAlign: 'left',
  padding: '5px 6px',
  borderBottom: `1px solid ${rule}`,
};
const td: React.CSSProperties = {
  fontSize: 9,
  color: text,
  padding: '6px 6px',
  borderBottom: `1px solid ${hair}`,
  verticalAlign: 'top',
};
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const strong: React.CSSProperties = { fontWeight: 700, color: ink };
const total: React.CSSProperties = { ...td, ...strong, borderBottom: `1px solid ${ink}` };

// ── Page A4 ─────────────────────────────────────────────────────────────────
const Sheet = ({
  children,
  page,
  pages,
  running,
}: {
  children: React.ReactNode;
  page: number;
  pages: number;
  /** Rappel en haut des pages suivantes (entreprise, document) */
  running?: { company: string; title: string };
}) => (
  <section
    className="print-sheet"
    data-testid="print-sheet"
    style={{
      width: '210mm',
      minHeight: '296mm',
      boxSizing: 'border-box',
      padding: '14mm 14mm 10mm',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      position: 'relative',
    }}
  >
    {running && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 8,
          color: muted,
          borderBottom: `1px solid ${rule}`,
          paddingBottom: 6,
          marginBottom: 14,
        }}
      >
        <span style={{ fontWeight: 600, color: text }}>{running.company}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {running.title}
          <Logo size={11} />
        </span>
      </div>
    )}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        fontSize: 7.5,
        color: muted,
        borderTop: `1px solid ${rule}`,
        paddingTop: 6,
        marginTop: 12,
      }}
    >
      <span>
        Quantités calculées à partir du plan, marge de sécurité incluse — à vérifier sur site avant
        commande.
      </span>
      <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span>
          Page {page} / {pages}
        </span>
        <span style={{ width: 1, height: 10, background: rule }} />
        <span>Établi avec</span>
        <Brand size={11} font={8.5} />
      </span>
    </div>
  </section>
);

const CutBadge = ({ n }: { n: number }) => (
  <span
    style={{
      display: 'inline-flex',
      width: 15,
      height: 15,
      borderRadius: 99,
      border: `1px solid ${ink}`,
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 8,
      fontWeight: 600,
      color: ink,
    }}
  >
    {n}
  </span>
);

const Legend = ({ withStart }: { withStart: boolean }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      fontSize: 8,
      color: text,
      borderTop: `1px solid ${hair}`,
      paddingTop: 6,
      marginTop: 4,
      alignItems: 'center',
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="12" height="9" aria-hidden>
        <rect x=".5" y=".5" width="11" height="8" fill="#fff" stroke="#6b7280" />
      </svg>
      Carreau entier
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="12" height="9" aria-hidden>
        <rect x=".5" y=".5" width="11" height="8" fill="#e5e7eb" stroke="#6b7280" />
        <path d="M1 8 L8 1 M5 8.5 L11.5 2" stroke="#9ca3af" />
      </svg>
      Coupe
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <CutBadge n={1} />
      Repère de coupe (tableau ci-dessous)
    </span>
    {withStart && (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <svg width="12" height="9" aria-hidden>
          <rect
            x=".75"
            y=".75"
            width="10.5"
            height="7.5"
            fill={brandLight}
            stroke={brand}
            strokeWidth="1.5"
          />
        </svg>
        Carreau de départ D
      </span>
    )}
  </div>
);

// ── Document ────────────────────────────────────────────────────────────────
export const QuantitiesPrintView = ({
  project,
  rooms: roomsProp,
  doorOpenings = [],
  company = null,
  now,
}: QuantitiesPrintViewProps) => {
  const { config, wallThickness, client, name, description } = project;
  const rooms = (roomsProp ?? project.rooms).filter((r) => r.points.length >= 3);
  const companyName = company?.name ?? null;
  const hasCompany = !!company && !!(company.name || company.logoUrl);

  const wallEngine = project.wallEngine;
  const printWalls = (wallEngine?.walls ?? []).filter((w) => !w.isDoor);
  const printNodes = wallEngine?.nodes ?? [];
  // Murs + « bouchons » aux nœuds (jonctions multiples, angles très aigus)
  const wallPolygons = [
    ...computeCornerGeometry(printWalls, printNodes),
    ...computeNodeCaps(printWalls, printNodes).map((points, i) => ({ wallId: `cap-${i}`, points })),
  ];

  const today = now ?? new Date();
  const date = today.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const reference = documentRef(project, today);

  const perRoom = rooms
    .map((room) => ({
      room,
      result: analyzeQuantities([room], config, wallThickness, doorOpenings),
    }))
    .filter(({ result }) => result.totalTiles > 0);
  const all = analyzeQuantities(rooms, config, wallThickness, doorOpenings);
  const c = all.consumables;
  const pages = 1 + perRoom.length;
  const tileM2 = (all.toOrder * all.tileW * all.tileH) / 1e6;
  const running = { company: companyName ?? '', title: `Quantitatif de calepinage · ${name}` };

  const keyFigures: [string, string][] = [
    ['Surface à carreler', printM2(all.roomArea)],
    ['Carreaux posés', printNb(all.totalTiles)],
    ['dont coupes', printNb(all.cuts.length)],
    ['Carreaux à commander', printNb(all.toOrder)],
  ];
  const orderLines: { item: string; detail: string; qty: number; unit: string }[] = [
    {
      item: `Carreaux ${printCm(all.tileW).replace(' cm', '')} × ${printCm(all.tileH)}`,
      detail: `Soit ${tileM2.toFixed(2).replace('.', ',')} m² · marge ${Math.round(all.margin * 100)} % incluse`,
      qty: all.toOrder,
      unit: 'carreaux',
    },
    {
      item: 'Mortier-colle',
      detail: `Sac de ${c.colle.bagSize} kg · ${c.colle.rendement.toFixed(1).replace('.', ',')} kg/m²`,
      qty: c.colle.bags,
      unit: c.colle.bags > 1 ? 'sacs' : 'sac',
    },
    {
      item: 'Mortier joint',
      detail: `Sac de ${c.joint.bagSize} kg · joint ${all.joint} mm`,
      qty: c.joint.bags,
      unit: c.joint.bags > 1 ? 'sacs' : 'sac',
    },
    {
      item: `Croisillons ${all.joint} mm`,
      detail: `Sachet de ${c.croisillons.bagSize} · ${printNb(c.croisillons.total)} pièces`,
      qty: c.croisillons.bags,
      unit: c.croisillons.bags > 1 ? 'sachets' : 'sachet',
    },
  ];

  return (
    <div style={{ fontFamily: sans, color: ink, background: '#fff' }}>
      {/* ─────────── Page 1 : synthèse ─────────── */}
      <Sheet page={1} pages={pages}>
        <div style={{ height: 4, background: brand, margin: '-14mm -14mm 12mm' }} />

        {/* En-tête : entreprise à gauche, document à droite */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {hasCompany && company ? (
            <div
              data-testid="print-company"
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              {company.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name ?? 'Logo'}
                  style={{ maxHeight: 44, maxWidth: 140, objectFit: 'contain' }}
                />
              )}
              <div style={{ fontSize: 8.5, lineHeight: 1.5, color: text }}>
                {company.name && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: ink, marginBottom: 2 }}>
                    {company.name}
                  </div>
                )}
                {company.address && <div>{company.address}</div>}
                {(company.phone || company.email) && (
                  <div>{[company.phone, company.email].filter(Boolean).join(' · ')}</div>
                )}
                {company.siret && <div>SIRET {company.siret}</div>}
              </div>
            </div>
          ) : (
            <span />
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Brand size={18} font={12.5} />
            </div>
            <h1
              style={{
                fontFamily: serif,
                fontSize: 22,
                fontWeight: 400,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              Quantitatif de calepinage
            </h1>
            <table style={{ marginLeft: 'auto', marginTop: 6, borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Référence', reference],
                  ['Date', date],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontSize: 8.5, color: muted, paddingRight: 10 }}>{k}</td>
                    <td style={{ fontSize: 8.5, ...strong, fontWeight: 600, textAlign: 'right' }}>
                      {v}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <TitleRule />
        </div>

        {/* Chantier / client */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div style={{ border: `1px solid ${rule}`, padding: '9px 11px' }}>
            <Label>Chantier</Label>
            <div style={{ fontFamily: serif, fontSize: 14, lineHeight: 1.15 }}>{name}</div>
            {description && (
              <div style={{ fontSize: 9, color: text, marginTop: 2 }}>{description}</div>
            )}
            {client?.address && (
              <div style={{ fontSize: 9, color: text, marginTop: 2, whiteSpace: 'pre-line' }}>
                {client.address}
              </div>
            )}
          </div>
          <div
            data-testid="print-client"
            style={{ border: `1px solid ${rule}`, padding: '9px 11px' }}
          >
            <Label>Client</Label>
            <div style={{ fontFamily: serif, fontSize: 14, lineHeight: 1.15 }}>
              {client?.name || '—'}
            </div>
            {(client?.phone || client?.email) && (
              <div style={{ fontSize: 9, color: text, marginTop: 2 }}>
                {[client?.phone, client?.email].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {all.totalTiles > 0 && (
          <>
            {/* Chiffres clés */}
            <div
              data-testid="print-key-figures"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                border: `1px solid ${rule}`,
                marginTop: 14,
              }}
            >
              {keyFigures.map(([k, v], i) => {
                const main = i === keyFigures.length - 1;
                return (
                  <div
                    key={k}
                    style={{
                      padding: '9px 11px',
                      borderLeft: i ? `1px solid ${rule}` : undefined,
                      background: main ? brandLight : undefined,
                      boxShadow: main ? `inset 3px 0 0 ${brand}` : undefined,
                    }}
                  >
                    <Label>{k}</Label>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: main ? brand : ink,
                      }}
                    >
                      {v}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 1. Liste de commande */}
            <SectionTitle n={1}>Liste de commande</SectionTitle>
            <table data-testid="print-order" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Désignation</th>
                  <th style={th}>Caractéristiques</th>
                  <th style={{ ...th, ...num }}>Quantité</th>
                  <th style={th}>Unité</th>
                </tr>
              </thead>
              <tbody>
                {orderLines.map((l) => (
                  <tr key={l.item}>
                    <td style={{ ...td, fontWeight: 600, color: ink }}>{l.item}</td>
                    <td style={td}>{l.detail}</td>
                    <td style={{ ...td, ...num, ...strong }}>{printNb(l.qty)}</td>
                    <td style={td}>{l.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 2. Répartition par pièce */}
            <SectionTitle n={2}>Répartition par pièce</SectionTitle>
            <table data-testid="print-rooms" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Pièce</th>
                  <th style={{ ...th, ...num }}>Surface</th>
                  <th style={{ ...th, ...num }}>Entiers</th>
                  <th style={{ ...th, ...num }}>Coupes</th>
                  <th style={{ ...th, ...num }}>Posés</th>
                  <th style={{ ...th, ...num }}>Page</th>
                </tr>
              </thead>
              <tbody>
                {perRoom.map(({ room, result }, i) => (
                  <tr key={room.id}>
                    <td style={{ ...td, fontWeight: 600, color: ink }}>
                      {room.name ?? `Pièce ${i + 1}`}
                    </td>
                    <td style={{ ...td, ...num }}>{printM2(result.roomArea)}</td>
                    <td style={{ ...td, ...num }}>{printNb(result.wholeCount)}</td>
                    <td style={{ ...td, ...num }}>{printNb(result.cuts.length)}</td>
                    <td style={{ ...td, ...num }}>{printNb(result.totalTiles)}</td>
                    <td style={{ ...td, ...num, color: muted }}>{i + 2}</td>
                  </tr>
                ))}
                <tr>
                  <td style={total}>Total</td>
                  <td style={{ ...total, ...num }}>{printM2(all.roomArea)}</td>
                  <td style={{ ...total, ...num }}>{printNb(all.wholeCount)}</td>
                  <td style={{ ...total, ...num }}>{printNb(all.cuts.length)}</td>
                  <td style={{ ...total, ...num }}>{printNb(all.totalTiles)}</td>
                  <td style={total} />
                </tr>
              </tbody>
            </table>

            {/* 3. Paramètres de pose */}
            <SectionTitle n={3}>Paramètres de pose</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                ['Format', `${printCm(all.tileW)} × ${printCm(all.tileH)}`],
                ['Joint', `${all.joint} mm`],
                ['Type de pose', poseLabel(config)],
                ['Orientation', config.angle ? `${config.angle}°` : 'Parallèle aux murs'],
              ].map(([k, v]) => (
                <div key={k}>
                  <Label>{k}</Label>
                  <div style={{ fontSize: 9.5, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Observations et accord du client, en bas de page */}
        <div style={{ flex: 1 }} />
        <div
          data-testid="print-approval"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 26,
            breakInside: 'avoid',
          }}
        >
          <div>
            <Label>Observations</Label>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ borderBottom: `1px solid ${hair}`, height: 16 }} />
            ))}
          </div>
          <div style={{ border: `1px solid ${rule}`, padding: '9px 11px', minHeight: 70 }}>
            <Label>Bon pour accord — date et signature du client</Label>
          </div>
        </div>
      </Sheet>

      {/* ─────────── Une page par pièce ─────────── */}
      {perRoom.map(({ room, result }, i) => {
        const { groups } = cutNumbers(result);
        const start = config.showStartTile
          ? computeStartTiles([room], result.tiles, config, wallThickness)[0]
          : undefined;
        const roomName = room.name ?? `Pièce ${i + 1}`;
        return (
          <Sheet key={room.id} page={i + 2} pages={pages} running={running}>
            <div
              data-testid="print-room"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                paddingBottom: 6,
              }}
            >
              <h2
                style={{
                  fontFamily: serif,
                  fontSize: 19,
                  fontWeight: 400,
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                <span style={{ color: brand, marginRight: 8 }}>{i + 1}.</span>
                {roomName}
              </h2>
              <div style={{ fontSize: 9, color: text, whiteSpace: 'nowrap' }}>
                {printM2(result.roomArea)} · {printNb(result.wholeCount)} entiers ·{' '}
                {printNb(result.cuts.length)} coupes · {printNb(result.totalTiles)} posés
              </div>
            </div>
            <TitleRule height={2} accent={48} />

            <div
              style={{
                border: `1px solid ${rule}`,
                marginTop: 12,
                padding: '8px 10px 6px',
                breakInside: 'avoid',
              }}
            >
              <QuantityPrintPlan
                room={room}
                result={result}
                config={config}
                wallThickness={wallThickness}
                wallPolygons={wallPolygons}
                doorOpenings={doorOpenings}
                start={start}
              />
              <Legend withStart={!!start} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: start ? '1.7fr 1fr' : '1fr',
                gap: 16,
              }}
            >
              <div>
                <SectionTitle>Coupes à réaliser</SectionTitle>
                {groups.length > 0 ? (
                  <table
                    data-testid="print-cuts"
                    style={{ width: '100%', borderCollapse: 'collapse' }}
                  >
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 34 }}>Repère</th>
                        <th style={th}>Dimension</th>
                        <th style={{ ...th, ...num }}>Coupes</th>
                        <th style={{ ...th, ...num }}>Dont sur chute</th>
                        <th style={th}>Chute restante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g, k) => (
                        <tr key={g.originalIndices.join(',')} style={{ breakInside: 'avoid' }}>
                          <td style={td}>
                            <CutBadge n={k + 1} />
                          </td>
                          <td style={{ ...td, fontWeight: 600, color: ink }}>
                            {printCm(g.usedW)} × {printCm(g.usedH)}
                          </td>
                          <td style={{ ...td, ...num, ...strong }}>{g.totalCount}</td>
                          <td style={{ ...td, ...num, color: g.reuseCount ? text : muted }}>
                            {g.reuseCount || '—'}
                          </td>
                          <td style={{ ...td, color: muted }}>
                            {g.chuteW > 200 && g.chuteH > 200
                              ? `${printCm(g.chuteW)} × ${printCm(g.chuteH)}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 9, color: muted }}>Aucune coupe : carreaux entiers.</div>
                )}
              </div>
              {start && (
                <div data-testid="print-implantation" style={{ breakInside: 'avoid' }}>
                  <SectionTitle>Implantation</SectionTitle>
                  <div style={{ fontSize: 8.5, color: text, lineHeight: 1.5, marginBottom: 6 }}>
                    Poser le carreau de départ <b style={{ color: brand }}>D</b> en premier. Coin 1
                    : angle du carreau côté angle de la pièce ; coin 2 : angle voisin le long du
                    mur.
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {start.cotes.map((cote, k) => (
                        <tr key={k}>
                          <td style={td}>
                            {k < 2 ? 'Coin 1' : 'Coin 2'} →{' '}
                            {wallName(cote.from, room, wallThickness)}
                          </td>
                          <td style={{ ...td, ...num, ...strong }}>{formatCote(cote.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 7.5, color: muted, marginTop: 6, lineHeight: 1.45 }}>
                    Deux cotes au même mur garantissent l&apos;alignement, même si les murs ne sont
                    pas d&apos;équerre.
                  </div>
                </div>
              )}
            </div>
          </Sheet>
        );
      })}
    </div>
  );
};
