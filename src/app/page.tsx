import Link from 'next/link';

// ── Product canvas mockup ─────────────────────────────────────────────────────

const STEP = 26; // tile 24px + joint 2px

const ProductMockup = () => {
  // L-shaped room clip path
  const roomPts = '62,28 368,28 368,168 248,168 248,278 62,278';

  const tiles: { xi: number; yi: number }[] = [];
  for (let xi = 0; xi < 13; xi++) {
    for (let yi = 0; yi < 10; yi++) {
      tiles.push({ xi, yi });
    }
  }

  return (
    <div className="relative select-none">
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', bottom: '-15%', left: '50%', transform: 'translateX(-50%)',
        width: '70%', height: '50%',
        background: 'radial-gradient(ellipse, rgba(232,103,26,0.35) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />

      {/* App frame */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#0D1117',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 48px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>

        {/* Window chrome */}
        <div style={{
          padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#161B22', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 24 }}>
            {['Plan 2D', 'Calepinage', 'Quantitatif'].map((tab, i) => (
              <span key={tab} style={{
                fontSize: 11, fontWeight: i === 1 ? 600 : 400, letterSpacing: '0.01em',
                color: i === 1 ? '#E8671A' : 'rgba(255,255,255,0.28)',
                borderBottom: i === 1 ? '2px solid #E8671A' : '2px solid transparent',
                paddingBottom: 3,
              }}>{tab}</span>
            ))}
          </div>
          <div style={{ width: 48 }} />
        </div>

        {/* Canvas */}
        <svg width="480" height="310" viewBox="0 0 480 310" style={{ display: 'block' }}>
          <defs>
            <pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.65" fill="rgba(255,255,255,0.13)" />
            </pattern>
            <clipPath id="roomclip">
              <polygon points={roomPts} />
            </clipPath>
          </defs>

          {/* Background */}
          <rect width="480" height="310" fill="#0A0B0E" />
          <rect width="480" height="310" fill="url(#dotgrid)" />

          {/* Tiles clipped to room */}
          <g clipPath="url(#roomclip)">
            {tiles.map(({ xi, yi }) => {
              const x = 62 + xi * STEP;
              const y = 28 + yi * STEP;
              const edgeRight = xi >= 11;
              const edgeBottom = yi >= 8;
              const isCut = edgeRight || edgeBottom;
              return (
                <rect
                  key={`${xi}-${yi}`}
                  x={x + 0.5} y={y + 0.5}
                  width={23} height={23}
                  fill={isCut ? 'rgba(232,103,26,0.18)' : 'rgba(255,255,255,0.045)'}
                  stroke={isCut ? 'rgba(232,103,26,0.45)' : 'rgba(255,255,255,0.1)'}
                  strokeWidth="0.5"
                />
              );
            })}
          </g>

          {/* Room outline */}
          <polygon points={roomPts} fill="none" stroke="#E8671A" strokeWidth="1.5" strokeLinejoin="round" />

          {/* Vertex dots */}
          {[[62, 28], [368, 28], [368, 168], [248, 168], [248, 278], [62, 278]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#E8671A" />
          ))}

          {/* Dimension annotation (top) */}
          <g opacity="0.55">
            <line x1="62" y1="16" x2="368" y2="16" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <line x1="62" y1="11" x2="62" y2="21" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <line x1="368" y1="11" x2="368" y2="21" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <text x="215" y="12" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.45)" fontFamily="monospace">306 cm</text>
          </g>
          {/* Dimension annotation (left) */}
          <g opacity="0.55">
            <line x1="50" y1="28" x2="50" y2="278" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <line x1="45" y1="28" x2="55" y2="28" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <line x1="45" y1="278" x2="55" y2="278" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
            <text x="38" y="156" textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.45)" fontFamily="monospace" transform="rotate(-90 38 156)">250 cm</text>
          </g>

          {/* Stats panel */}
          <rect x="384" y="28" width="88" height="130" rx="10" fill="rgba(22,27,34,0.97)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
          <text x="428" y="50" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif" letterSpacing="0.08em">SURFACE</text>
          <text x="428" y="70" textAnchor="middle" fontSize="20" fontWeight="700" fill="#E6EDF3" fontFamily="sans-serif">8.5m²</text>
          <line x1="392" y1="80" x2="464" y2="80" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <text x="428" y="96" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif" letterSpacing="0.08em">CARREAUX</text>
          <text x="428" y="116" textAnchor="middle" fontSize="20" fontWeight="700" fill="#E8671A" fontFamily="sans-serif">94</text>
          <line x1="392" y1="124" x2="464" y2="124" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
          <text x="428" y="138" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="sans-serif" letterSpacing="0.06em">dont 12 coupes</text>
          <text x="428" y="150" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.3)" fontFamily="sans-serif">+7% de marge</text>

          {/* Toolbar icons */}
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x="10" y={18 + i * 34} width="28" height="28" rx="7"
              fill={i === 0 ? 'rgba(232,103,26,0.22)' : 'rgba(255,255,255,0.04)'}
              stroke={i === 0 ? 'rgba(232,103,26,0.5)' : 'rgba(255,255,255,0.07)'}
              strokeWidth="0.5" />
          ))}
        </svg>
      </div>
    </div>
  );
};

// ── Feature icons ─────────────────────────────────────────────────────────────

const IconPlan = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M2 6.5L11 2l9 4.5v9L11 20 2 15.5v-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M11 2v18M2 6.5l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const IconTile = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="2" width="7" height="7" rx="1.2" fill="currentColor" />
    <rect x="11" y="2" width="9" height="7" rx="1.2" fill="currentColor" opacity=".45" />
    <rect x="2" y="11" width="4" height="9" rx="1.2" fill="currentColor" opacity=".45" />
    <rect x="8" y="11" width="12" height="4" rx="1.2" fill="currentColor" opacity=".7" />
    <rect x="8" y="17" width="12" height="3" rx="1.2" fill="currentColor" opacity=".25" />
  </svg>
);

const IconQuant = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M4 6h6M4 10h4M4 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="12" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M15 9v10M12 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Landing page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(10,11,14,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div style={{
              width: 30, height: 30,
              background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(232,103,26,0.4)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" />
                <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".65" />
                <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".65" />
                <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#E6EDF3', letterSpacing: '-0.3px' }}>CaléPlan</span>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#tarifs" className="hidden md:block px-3 py-1.5 text-[13px] rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
              Tarifs
            </a>
            <Link href="/auth" className="px-3 py-1.5 text-[13px] rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              Connexion
            </Link>
            <Link href="/auth" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg transition-all"
              style={{ background: '#E8671A', color: '#fff', boxShadow: '0 2px 12px rgba(232,103,26,0.35)' }}>
              Commencer gratuitement
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{
        background: '#08090C',
        backgroundImage: `
          linear-gradient(rgba(232,103,26,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(232,103,26,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '52px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top-left glow */}
        <div style={{
          position: 'absolute', top: -100, left: -100,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(232,103,26,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: 'linear-gradient(transparent, #08090C)',
          pointerEvents: 'none',
        }} />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="flex flex-col gap-16 md:flex-row md:items-center md:gap-10">

            {/* Left — copy */}
            <div className="flex flex-col md:w-[48%]">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold tracking-wide"
                style={{ borderColor: 'rgba(232,103,26,0.4)', color: '#E8671A', background: 'rgba(232,103,26,0.08)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8671A', display: 'inline-block' }} />
                Outil professionnel · Carreleurs
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(38px, 5.5vw, 62px)',
                fontWeight: 800,
                color: '#E6EDF3',
                lineHeight: 1.05,
                letterSpacing: '-1.5px',
                marginBottom: 24,
              }}>
                Calepinage<br />
                <span style={{ color: '#E8671A' }}>sans erreur</span>,<br />
                livraison précise.
              </h1>

              <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', marginBottom: 36, maxWidth: 420 }}>
                Dessinez votre plan, simulez la pose, obtenez le quantitatif exact à la commande. En quelques minutes, pas en heures.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/auth" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px 28px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)',
                  color: '#fff', fontSize: 14.5, fontWeight: 700,
                  boxShadow: '0 4px 20px rgba(232,103,26,0.45)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  textDecoration: 'none',
                }}>
                  Commencer gratuitement
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
                <a href="#fonctions" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '13px 24px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)', fontSize: 14.5, fontWeight: 500,
                  transition: 'border-color 0.15s, color 0.15s',
                  textDecoration: 'none',
                }}>
                  Voir les fonctions
                </a>
              </div>

              {/* Social proof */}
              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {['#E8671A', '#4A7CB5', '#22c55e', '#a855f7'].map((c, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: c, border: '2px solid #08090C',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff',
                    }}>
                      {['JD', 'ML', 'AT', 'PB'][i]}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)' }}>
                  Utilisé par <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>+200 carreleurs</span> professionnels
                </p>
              </div>
            </div>

            {/* Right — product mockup */}
            <div className="md:w-[52%]">
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <div style={{ background: '#E8671A' }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 divide-x divide-orange-600 md:grid-cols-4">
            {[
              { value: '3', label: 'Modes de pose' },
              { value: '1cm²', label: 'Précision du calcul' },
              { value: '100%', label: 'Cloud · Sauvegarde auto' },
              { value: '<2min', label: 'De la pièce au devis' },
            ].map(({ value, label }) => (
              <div key={label} className="px-6 py-5 text-center">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#fff' }}>{value}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="fonctions" style={{ background: '#fff', borderTop: '1px solid var(--bdr)' }}>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#E8671A' }}>Fonctionnalités</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.8px' }}>
              Du plan au bon de commande
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: <IconPlan />,
                accent: '#4A7CB5',
                accentLight: '#EBF2FF',
                title: 'Plan 2D',
                desc: 'Dessinez vos pièces directement dans le navigateur. Contraintes dimensionnelles, murs, portes, zones à exclure.',
                detail: 'Grille magnétique · Cotation automatique · Pièces multiples',
              },
              {
                icon: <IconTile />,
                accent: '#E8671A',
                accentLight: '#FEF3EC',
                title: 'Calepinage',
                desc: 'Posez vos carreaux en droit, bâton rompu ou pointe de Hongrie. Rotations et décalages libres, rendu en temps réel.',
                detail: '3 modes de pose · Aperçu instantané · Joint paramétrable',
              },
              {
                icon: <IconQuant />,
                accent: '#22c55e',
                accentLight: '#F0FDF4',
                title: 'Quantitatif',
                desc: 'Nombre de carreaux, détail des coupes, chutes récupérables, quantité à commander avec marge de sécurité.',
                detail: 'Export PDF · Marge paramétrable · Tableau des coupes',
              },
            ].map(({ icon, accent, accentLight, title, desc, detail }) => (
              <div key={title} style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: 16,
                padding: '28px 28px 24px',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(-3px)';
                  el.style.boxShadow = `0 12px 40px rgba(0,0,0,0.09), 0 0 0 1.5px ${accent}40`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = '';
                  el.style.boxShadow = '';
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: accentLight, color: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                }}>
                  {icon}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#6B7280', marginBottom: 18 }}>{desc}</p>
                <div style={{
                  borderTop: '1px solid #F3F4F6', paddingTop: 14,
                  fontSize: 11.5, color: accent, fontWeight: 600, letterSpacing: '0.02em',
                }}>{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="tarifs" style={{ background: '#08090C', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#E8671A' }}>Tarifs</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, color: '#E6EDF3', letterSpacing: '-0.8px' }}>
              Simple. Transparent.
            </h2>
          </div>

          <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
            {/* Free */}
            <div style={{
              background: '#161B22',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '32px 32px 28px',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Gratuit</div>
              <div className="mb-8 flex items-baseline gap-1.5">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 800, color: '#E6EDF3', letterSpacing: '-2px' }}>0€</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>pour toujours</span>
              </div>
              <ul className="mb-8 space-y-3">
                {['1 projet cloud', 'Toutes les fonctions', 'Sauvegarde automatique'].map(f => (
                  <li key={f} className="flex items-center gap-3" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                      <path d="M5 8l2 2 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '12px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s',
              }}>
                Commencer gratuitement
              </Link>
            </div>

            {/* Pro */}
            <div style={{
              background: 'linear-gradient(160deg, #1a0e06 0%, #0D1117 60%)',
              border: '1.5px solid #E8671A',
              borderRadius: 20, padding: '32px 32px 28px',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 0 60px rgba(232,103,26,0.15)',
            }}>
              {/* Corner glow */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 160, height: 160,
                background: 'radial-gradient(circle, rgba(232,103,26,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div className="mb-5 flex items-start justify-between">
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#E8671A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</div>
                <div style={{
                  padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(232,103,26,0.15)', border: '1px solid rgba(232,103,26,0.3)',
                  fontSize: 11, fontWeight: 700, color: '#E8671A',
                }}>Recommandé</div>
              </div>
              <div className="mb-8 flex items-baseline gap-1.5">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 800, color: '#E6EDF3', letterSpacing: '-2px' }}>9€</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>/mois</span>
              </div>
              <ul className="mb-8 space-y-3">
                {['Projets illimités', 'Toutes les fonctions', 'Sauvegarde automatique', 'Support prioritaire'].map(f => (
                  <li key={f} className="flex items-center gap-3" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" fill="rgba(232,103,26,0.15)" stroke="rgba(232,103,26,0.5)" strokeWidth="1" />
                      <path d="M5 8l2 2 4-4" stroke="#E8671A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '13px', borderRadius: 10,
                background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(232,103,26,0.4)',
              }}>
                Passer Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#06070A', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div style={{ width: 22, height: 22, background: '#E8671A', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" />
                <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".65" />
                <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".65" />
                <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-display)' }}>CaléPlan</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            © {new Date().getFullYear()} CaléPlan ·{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.2)' }}>Mentions légales</a>
            {' '}·{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.2)' }}>Contact</a>
          </p>
        </div>
      </footer>

    </div>
  );
}
