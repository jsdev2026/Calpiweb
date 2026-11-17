'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export const inputClass =
  'w-full rounded-lg border px-3 py-2 outline-none transition-colors focus:border-[var(--accent)]';
export const inputStyle = {
  borderColor: 'var(--bdr2, var(--bdr))',
  background: 'var(--surf)',
  color: 'var(--text)',
  fontSize: 16, // évite le zoom iOS au focus
} as const;

export const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <section
    className="rounded-2xl border p-4 md:p-6"
    style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
  >
    <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
      {title}
    </h2>
    {description && (
      <p className="mt-1 text-[12.5px]" style={{ color: 'var(--muted)' }}>
        {description}
      </p>
    )}
    <div className="mt-4 flex flex-col gap-4">{children}</div>
  </section>
);

export const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
      {label}
    </span>
    {children}
    {error ? (
      <span className="text-[12px]" style={{ color: '#dc2626' }}>
        {error}
      </span>
    ) : (
      hint && (
        <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {hint}
        </span>
      )
    )}
  </label>
);

export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={inputClass} style={inputStyle} />
);

export const SelectInput = ({
  options,
  placeholder = '—',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) => (
  <select {...props} className={inputClass} style={inputStyle}>
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const Grid2 = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
);

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const SaveBar = ({
  state,
  error,
  disabled,
  onSave,
  label = 'Enregistrer',
}: {
  state: SaveState;
  error?: string | null;
  disabled?: boolean;
  onSave: () => void;
  label?: string;
}) => (
  <div className="flex flex-wrap items-center justify-end gap-3">
    {state === 'saved' && (
      <span role="status" className="text-[12.5px]" style={{ color: '#16a34a' }}>
        Enregistré ✓
      </span>
    )}
    {state === 'error' && error && (
      <span role="alert" className="text-[12.5px]" style={{ color: '#dc2626' }}>
        {error}
      </span>
    )}
    <button
      type="button"
      onClick={onSave}
      disabled={disabled || state === 'saving'}
      className="btn-primary min-h-[44px] px-5 disabled:opacity-50"
    >
      {state === 'saving' ? 'Enregistrement…' : label}
    </button>
  </div>
);

/** Transforme une erreur Supabase en message compréhensible. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/column .* does not exist|PGRST204|schema cache/i.test(msg)) {
    return "Mise à jour de la base en attente : la migration 004 n'a pas encore été appliquée.";
  }
  if (/42501|permission denied/i.test(msg)) return 'Modification non autorisée.';
  if (/NOT_AUTHENTICATED/.test(msg)) return 'Session expirée : reconnectez-vous.';
  return msg;
}
