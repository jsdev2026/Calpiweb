// Identité du site pour le référencement (titres, adresse canonique, plan du site, partages).
// SITE_URL doit rester identique à celui de next.config.mjs (vérifié par un test).

export const SITE_URL = 'https://www.caleplan.com';
export const SITE_NAME = 'CaléPlan';

/** Titre de la page d'accueil (≈ 60 caractères : ce que Google affiche) */
export const HOME_TITLE = 'Calepinage carrelage en ligne gratuit — plan, pose, quantitatif';

export const HOME_DESCRIPTION =
  'Tracez la pièce, simulez la pose (droite, décalée, chevron) et obtenez le nombre exact de carreaux, cartons, colle, joint et plinthes. Gratuit et en ligne.';

/** Pages privées (compte requis) : jamais indexées */
export const PRIVATE_PATHS = ['/dashboard', '/project', '/settings', '/account', '/auth'] as const;
