'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ClientInfo } from '@/types/project';

interface NewProjectModalProps {
  defaultProjectName: string;
  onConfirm: (projectName: string, client: ClientInfo | undefined) => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--surf2)',
  border: '1px solid var(--bdr)',
  borderRadius: 'var(--rs)',
  fontSize: 13,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text2)',
  display: 'block',
  marginBottom: 4,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: 'var(--muted)',
  marginBottom: 10,
};

export const NewProjectModal = ({ defaultProjectName, onConfirm, onCancel }: NewProjectModalProps) => {
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const canSubmit = projectName.trim().length > 0;

  const handleConfirm = () => {
    if (!canSubmit) return;
    const hasClient = clientName.trim() || phone.trim() || email.trim() || address.trim();
    const client: ClientInfo | undefined = hasClient
      ? {
          name: clientName.trim() || 'Client',
          ...(phone.trim() && { phone: phone.trim() }),
          ...(email.trim() && { email: email.trim() }),
          ...(address.trim() && { address: address.trim() }),
        }
      : undefined;
    onConfirm(projectName.trim(), client);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)';
  };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--bdr)';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--bdr)' }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Nouveau projet
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Projet */}
          <section>
            <p style={sectionTitleStyle}>Projet</p>
            <label>
              <span style={labelStyle}>
                Nom du projet <span style={{ color: 'var(--accent)' }}>*</span>
              </span>
              <input
                ref={nameRef}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex. Salle de bain Dupont"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </label>
          </section>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'var(--bdr)' }} />

          {/* Client */}
          <section>
            <p style={sectionTitleStyle}>Client <span style={{ fontWeight: 400, opacity: 0.6 }}>(optionnel)</span></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Nom client */}
              <label>
                <span style={labelStyle}>Nom et prénom</span>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Marie Dupont"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </label>

              {/* Téléphone + Email côte à côte */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Téléphone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 00 00 00 00"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </label>
                <label>
                  <span style={labelStyle}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@mail.com"
                    style={inputStyle}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                </label>
              </div>

              {/* Adresse */}
              <label>
                <span style={labelStyle}>Adresse du chantier</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="12 rue de la Paix, 75001 Paris"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </label>

            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0 24px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--rs)',
              border: '1px solid var(--bdr2)',
              background: 'var(--surf)',
              color: 'var(--text2)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf)'; }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--rs)',
              border: 'none',
              background: canSubmit ? 'var(--accent)' : 'var(--bdr)',
              color: canSubmit ? '#fff' : 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            Créer le projet
          </button>
        </div>
      </div>
    </div>
  );
};
