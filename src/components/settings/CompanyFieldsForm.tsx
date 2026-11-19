'use client';
// Champs de la société (raison sociale, SIRET, TVA, adresse), partagés par l'onglet Profil
// (passage en compte professionnel) et l'onglet Entreprise.
import type { CompanyFields } from '@/lib/accountType';
import { Field, Grid2, TextInput } from './settingsUi';

export const CompanyFieldsForm = ({
  draft,
  set,
  errors,
  required,
}: {
  draft: Partial<CompanyFields>;
  set: (field: keyof CompanyFields, value: string) => void;
  errors: Partial<Record<keyof CompanyFields, string | null | undefined>>;
  /** Compte professionnel : raison sociale, SIRET et adresse obligatoires */
  required: boolean;
}) => {
  const star = required ? ' *' : '';
  return (
    <>
      <Field label={`Raison sociale${star}`} error={errors.companyName}>
        <TextInput
          value={draft.companyName ?? ''}
          onChange={(e) => set('companyName', e.target.value)}
          autoComplete="organization"
          aria-label="Raison sociale"
        />
      </Field>
      <Grid2>
        <Field label={`SIRET${star}`} error={errors.siret}>
          <TextInput
            inputMode="numeric"
            value={draft.siret ?? ''}
            onChange={(e) => set('siret', e.target.value)}
            placeholder="14 chiffres"
            aria-label="SIRET"
          />
        </Field>
        <Field
          label="N° de TVA intracommunautaire"
          error={errors.vatNumber}
          hint={required ? 'Facultatif.' : undefined}
        >
          <TextInput
            value={draft.vatNumber ?? ''}
            onChange={(e) => set('vatNumber', e.target.value)}
            placeholder="FR00123456789"
            aria-label="N° de TVA intracommunautaire"
          />
        </Field>
      </Grid2>
      <Field label={`Adresse${star}`} error={errors.addressLine}>
        <TextInput
          value={draft.addressLine ?? ''}
          onChange={(e) => set('addressLine', e.target.value)}
          autoComplete="street-address"
          aria-label="Adresse"
        />
      </Field>
      <div className="grid grid-cols-[120px_1fr] gap-4">
        <Field label={`Code postal${star}`} error={errors.postalCode}>
          <TextInput
            inputMode="numeric"
            value={draft.postalCode ?? ''}
            onChange={(e) => set('postalCode', e.target.value)}
            autoComplete="postal-code"
            aria-label="Code postal"
          />
        </Field>
        <Field label={`Ville${star}`} error={errors.city}>
          <TextInput
            value={draft.city ?? ''}
            onChange={(e) => set('city', e.target.value)}
            autoComplete="address-level2"
            aria-label="Ville"
          />
        </Field>
      </div>
    </>
  );
};
