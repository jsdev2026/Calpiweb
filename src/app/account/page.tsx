import { redirect } from 'next/navigation';

// L'ancienne page « Mon compte » est désormais l'onglet Forfait des Paramètres.
export default function AccountPage() {
  redirect('/settings?tab=forfait');
}
