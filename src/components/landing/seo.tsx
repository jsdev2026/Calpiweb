// Contenus de référencement de la page d'accueil : FAQ (affichée et décrite pour Google)
// et données structurées du logiciel. Un seul texte pour les deux : Google exige que la FAQ
// décrite corresponde à celle visible sur la page.
import { PRICE_EXTRA_PROJECT, PRICE_PRO_MONTHLY } from '@/constants/pricing';
import { HOME_DESCRIPTION, SITE_NAME, SITE_URL } from '@/constants/site';

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Qu’est-ce que le calepinage de carrelage ?',
    a: 'C’est le plan de pose des carreaux : où démarre le premier carreau, comment ils se décalent, où tombent les coupes. Un bon calepinage évite les petites coupes disgracieuses le long des murs et permet de commander la juste quantité.',
  },
  {
    q: 'Comment calculer le nombre de carreaux à commander ?',
    a: 'Tracez votre pièce dans CaléPlan et choisissez le format de carreau : le logiciel pose les carreaux un à un, compte les carreaux entiers et coupés, réutilise les chutes quand c’est possible et ajoute une marge de sécurité adaptée au type de pose. Vous obtenez le nombre de carreaux et de cartons à commander.',
  },
  {
    q: 'CaléPlan est-il gratuit ?',
    a: `Oui : votre premier projet est gratuit, avec toutes les fonctions et l’export PDF. Ensuite, vous pouvez acheter un projet à l’unité (${PRICE_EXTRA_PROJECT}) ou passer à l’abonnement Pro (${PRICE_PRO_MONTHLY} par mois) pour des projets illimités.`,
  },
  {
    q: 'Quels types de pose sont pris en charge ?',
    a: 'La pose droite, la pose décalée (1/3 ou 1/2), le chevron et le bâton rompu, avec le joint de votre choix. Vous pouvez aussi placer et coter le carreau de départ pour le chantier.',
  },
  {
    q: 'CaléPlan calcule-t-il aussi la colle, le joint et les plinthes ?',
    a: 'Oui. Le quantitatif donne le nombre de sacs de colle et de joint, les croisillons, les cartons de carrelage (selon le conditionnement du fabricant) et les plinthes, portes déduites. Le tout s’exporte en PDF pour la commande.',
  },
  {
    q: 'Faut-il installer un logiciel ?',
    a: 'Non. CaléPlan fonctionne dans le navigateur, sur ordinateur, tablette et smartphone. Vos projets sont sauvegardés automatiquement dans votre compte.',
  },
];

/** Données structurées (schema.org) : le logiciel et sa FAQ */
export const structuredData = () => [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    description: HOME_DESCRIPTION,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr',
    offers: [
      { '@type': 'Offer', name: 'Gratuit — 1 projet', price: '0', priceCurrency: 'EUR' },
      {
        '@type': 'Offer',
        name: 'Projet à l’unité',
        price: PRICE_EXTRA_PROJECT.replace(/[^\d,]/g, '').replace(',', '.'),
        priceCurrency: 'EUR',
      },
      {
        '@type': 'Offer',
        name: 'Abonnement Pro (mensuel)',
        price: PRICE_PRO_MONTHLY.replace(/[^\d,]/g, '').replace(',', '.'),
        priceCurrency: 'EUR',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
];

/** Balise <script type="application/ld+json"> (contenu fixe, sans saisie utilisateur) */
export const StructuredData = () => (
  <script
    type="application/ld+json"
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c'),
    }}
  />
);

/** Section « Questions fréquentes » de la page d'accueil */
export const LandingFaq = () => (
  <section
    id="faq"
    aria-labelledby="faq-title"
    style={{ background: '#08090C', borderTop: '1px solid rgba(255,255,255,0.07)' }}
  >
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p
        className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em]"
        style={{ color: '#E8671A' }}
      >
        Questions fréquentes
      </p>
      <h2
        id="faq-title"
        className="mb-10 text-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: 400,
          color: '#E6EDF3',
        }}
      >
        Tout savoir sur le calepinage
      </h2>
      <div className="flex flex-col gap-3">
        {FAQ.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border px-5 py-4"
            style={{ background: '#161B22', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden"
              style={{ color: '#E6EDF3' }}
            >
              <h3 className="text-[15px] font-semibold">{f.q}</h3>
              <span
                aria-hidden
                className="shrink-0 text-[20px] leading-none transition-transform group-open:rotate-45"
                style={{ color: '#E8671A' }}
              >
                +
              </span>
            </summary>
            <p
              className="mt-3 text-[14px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
