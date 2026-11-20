# Modèles d’e-mails (Supabase Auth)

E-mails envoyés par Supabase (via le SMTP Brevo, expéditeur `noreply@caleplan.com`), en français
et aux couleurs de CaléPlan. À coller dans **Supabase → Authentication → Emails → Templates**.

| Modèle Supabase      | Fichier                 | Objet (« Subject »)                                |
| -------------------- | ----------------------- | -------------------------------------------------- |
| Confirm signup       | `confirmation.html`     | Confirmez votre adresse e-mail — CaléPlan          |
| Reset password       | `reinitialisation.html` | Réinitialisez votre mot de passe CaléPlan          |
| Change email address | `changement-email.html` | Confirmez votre nouvelle adresse e-mail — CaléPlan |

Pour chaque modèle :

1. Ouvrir le modèle dans Supabase.
2. Remplacer l’objet par celui du tableau.
3. Remplacer **tout** le contenu (« Message body », onglet Source) par le fichier HTML.
4. Enregistrer (« Save changes »).

Variables Supabase utilisées : `{{ .ConfirmationURL }}` (lien du bouton), `{{ .Email }}` et
`{{ .NewEmail }}` (changement d’adresse), `{{ .Data.first_name }}` (prénom saisi à l’inscription,
« Bonjour, » s’il manque).

Ces fichiers sont générés : modifier le texte ici, puis recoller dans Supabase. Ils sont exclus de
Prettier (`.prettierignore`) pour ne pas toucher aux variables.
