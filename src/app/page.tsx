import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid var(--bdr)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white"/>
              <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>CaléPlan</span>
        </div>
        <nav className="flex items-center gap-3">
          <a href="#tarifs" className="hidden md:block text-[13.5px]" style={{ color: 'var(--text2)' }}>Tarifs</a>
          <Link href="/auth" className="text-[13.5px] font-medium" style={{ color: 'var(--text2)' }}>Connexion</Link>
          <Link href="/auth" className="btn-primary hidden md:flex text-[13px] px-4 py-2">Commencer gratuitement</Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 rounded-full border px-4 py-1.5 text-[12px] font-semibold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-l)' }}>
          Outil professionnel pour carreleurs
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }} className="mb-6 max-w-3xl">
          Le calepinage carrelage<br />pour les professionnels
        </h1>
        <p className="mb-10 max-w-xl text-[16px] leading-relaxed" style={{ color: 'var(--text2)' }}>
          Dessinez vos pièces, simulez la pose et obtenez un quantitatif précis en quelques minutes. Sauvegarde cloud automatique.
        </p>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link href="/auth" className="btn-primary px-7 py-3 text-[15px] text-center">Commencer gratuitement</Link>
          <a href="#fonctions" className="rounded-xl border px-7 py-3 text-[15px] font-medium text-center transition-colors" style={{ borderColor: 'var(--bdr)', color: 'var(--text2)', background: 'var(--surf)' }}>
            Voir les fonctions
          </a>
        </div>
      </main>

      {/* Features */}
      <section id="fonctions" className="px-8 py-16" style={{ borderTop: '1px solid var(--bdr)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }} className="mb-12">
          Tout ce dont vous avez besoin
        </h2>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { emoji: '✏️', title: 'Plan 2D', desc: 'Dessinez vos pièces avec contraintes dimensionnelles, murs, portes et zones exclues.' },
            { emoji: '🏁', title: 'Calepinage', desc: '3 modes de pose : droit, bâton rompu, pointe de hongrie. Rotation et décalage libres.' },
            { emoji: '📦', title: 'Quantitatif', desc: 'Nombre de carreaux, coupes, chutes récupérables, quantité à commander avec marge.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border p-7" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
              <div className="mb-4 text-3xl">{f.emoji}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }} className="mb-2">{f.title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="px-8 py-16" style={{ borderTop: '1px solid var(--bdr)', background: 'var(--surf2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }} className="mb-12">
          Tarifs simples
        </h2>
        <div className="mx-auto flex max-w-2xl flex-col justify-center gap-6 sm:flex-row">
          {[
            {
              name: 'Gratuit', price: '0', period: '', highlight: false,
              features: ['1 projet cloud', 'Toutes les fonctions', 'Sauvegarde automatique'],
              cta: 'Commencer gratuitement',
            },
            {
              name: 'Pro', price: '9', period: '/mois', highlight: true,
              features: ['Projets illimités', 'Toutes les fonctions', 'Sauvegarde automatique', 'Support prioritaire'],
              cta: 'Passer Pro',
            },
          ].map((plan) => (
            <div key={plan.name} className="flex-1 rounded-2xl border p-8" style={{
              background: 'var(--surf)',
              borderColor: plan.highlight ? 'var(--accent)' : 'var(--bdr)',
              borderWidth: plan.highlight ? 2 : 1,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: plan.highlight ? 'var(--accent)' : 'var(--text)' }} className="mb-3">{plan.name}</div>
              <div className="mb-6 flex items-baseline gap-1">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: 'var(--text)' }}>{plan.price}€</span>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>{plan.period}</span>
              </div>
              <ul className="mb-8 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--text2)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth" className={plan.highlight ? 'btn-primary w-full justify-center py-2.5 text-[14px]' : 'block w-full rounded-xl border py-2.5 text-center text-[14px] font-medium transition-colors'}
                style={plan.highlight ? {} : { borderColor: 'var(--bdr)', color: 'var(--text2)' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 text-center text-[12.5px]" style={{ color: 'var(--muted)', borderTop: '1px solid var(--bdr)' }}>
        © {new Date().getFullYear()} CaléPlan · <a href="#" style={{ color: 'var(--muted)' }}>Mentions légales</a> · <a href="#" style={{ color: 'var(--muted)' }}>Contact</a>
      </footer>

    </div>
  );
}
