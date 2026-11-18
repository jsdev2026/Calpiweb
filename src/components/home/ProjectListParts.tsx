'use client';
// Éléments de la vue « Mes projets » : compteurs-filtres, menu ⋯ d'un projet,
// confirmation de suppression, pastille de statut.
import { useEffect, useRef, useState } from 'react';
import { FolderOpen, MoreHorizontal, Share2, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { ProjectStatus } from '@/types/project';
import { STATUS_DOT, STATUS_LABELS, type StatusFilter } from './projectList';

export const StatusDot = ({ status, size = 7 }: { status: ProjectStatus; size?: number }) => (
  <span
    aria-hidden
    className="inline-block shrink-0 rounded-full"
    style={{ width: size, height: size, background: STATUS_DOT[status] }}
  />
);

/** Pastille de statut posée sur la miniature */
export const StatusPill = ({ status }: { status: ProjectStatus }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
    style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', color: 'var(--text2)' }}
  >
    <StatusDot status={status} size={6} />
    {STATUS_LABELS[status]}
  </span>
);

const FILTER_TILES: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'new', label: 'Nouveaux' },
  { id: 'wip', label: 'En cours' },
  { id: 'done', label: 'Terminés' },
];

/** Compteurs cliquables : chaque case filtre la liste sur son statut */
export const StatusFilterTiles = ({
  counts,
  value,
  onChange,
}: {
  counts: Record<StatusFilter, number>;
  value: StatusFilter;
  onChange: (f: StatusFilter) => void;
}) => (
  <div className="grid grid-cols-4 gap-2 sm:gap-3" role="group" aria-label="Filtrer par statut">
    {FILTER_TILES.map((t) => {
      const active = t.id === value;
      return (
        <button
          key={t.id}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(t.id)}
          className="min-w-0 rounded-[var(--r)] border px-2 py-2 text-left transition-colors hover:border-[var(--accent)] sm:px-4 sm:py-3"
          style={{
            background: active ? 'var(--accent-l)' : 'var(--surf)',
            borderColor: active ? 'var(--accent)' : 'var(--bdr)',
            boxShadow: active ? 'none' : 'var(--sh)',
          }}
        >
          {/* Le point de statut accompagne le nombre : le libellé garde toute la largeur */}
          <div className="flex items-center gap-1.5">
            {t.id !== 'all' && <StatusDot status={t.id} />}
            <span
              className="text-[20px] leading-none sm:text-[24px]"
              style={{
                fontFamily: 'var(--font-display)',
                color: active ? 'var(--accent)' : 'var(--text)',
              }}
            >
              {counts[t.id]}
            </span>
          </div>
          <div
            className="mt-1.5 text-[10.5px] leading-tight sm:text-[12px]"
            style={{ color: active ? 'var(--accent)' : 'var(--text2)' }}
          >
            {t.label}
          </div>
        </button>
      );
    })}
  </div>
);

/** Menu ⋯ d'un projet : ouvrir, paramètres, partager, supprimer (toujours visible) */
export const ProjectActionsMenu = ({
  projectName,
  canShare,
  onOpen,
  onSettings,
  onShare,
  onDelete,
}: {
  projectName: string;
  canShare: boolean;
  onOpen: () => void;
  onSettings: () => void;
  onShare: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    document.addEventListener('touchstart', out);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('touchstart', out);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const item = (label: string, icon: React.ReactNode, action: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        setOpen(false);
        action();
      }}
      className="flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors hover:bg-[var(--surf2)]"
      style={{ color: danger ? '#ef4444' : 'var(--text2)' }}
    >
      <span aria-hidden className="flex w-4 justify-center">
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    // Les clics dans le menu n'ouvrent pas le projet (la vignette entière est cliquable)
    <div
      className="relative"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions du projet ${projectName}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surf2)] mouse:h-7 mouse:w-7"
        style={{
          borderColor: open ? 'var(--accent)' : 'var(--bdr)',
          color: open ? 'var(--accent)' : 'var(--text2)',
          background: 'var(--surf)',
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-40 mb-1 w-56 rounded-xl p-1 shadow-xl"
          style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
        >
          {item('Ouvrir', <FolderOpen size={14} />, onOpen)}
          {item('Paramètres du projet', <SlidersHorizontal size={14} />, onSettings)}
          {canShare && item('Partager', <Share2 size={14} />, onShare)}
          <div className="my-1 h-px" style={{ background: 'var(--bdr)' }} />
          {item('Supprimer…', <Trash2 size={14} />, onDelete, true)}
        </div>
      )}
    </div>
  );
};

/** Confirmation avant de supprimer un projet (remplace la boîte du navigateur) */
export const ConfirmDeleteDialog = ({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center p-3 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="w-full max-w-[400px] rounded-2xl border p-5"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', boxShadow: 'var(--sh-lg)' }}
      >
        <h2
          id="delete-title"
          className="text-[16px] font-semibold"
          style={{ color: 'var(--text)' }}
        >
          Supprimer « {projectName} » ?
        </h2>
        <p
          id="delete-desc"
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: 'var(--text2)' }}
        >
          Le plan, le calepinage et le quantitatif de ce projet seront définitivement supprimés.
          Cette action est irréversible.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-[var(--rs)] px-3.5 py-2 text-[13px] font-semibold text-white"
            style={{ background: '#dc2626' }}
          >
            <Trash2 size={14} aria-hidden />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};
