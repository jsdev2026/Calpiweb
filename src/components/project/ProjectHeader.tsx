'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  FileDown,
  LogOut,
  Moon,
  MoreHorizontal,
  Pencil,
  Settings,
  SlidersHorizontal,
  Sun,
  User,
  GraduationCap,
} from 'lucide-react';
import type { ProjectStatus } from '@/types/project';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  new: 'Nouveau',
  wip: 'En cours',
  done: 'Terminé',
};
const STATUS_CLASS: Record<ProjectStatus, string> = {
  new: 'tag-new',
  wip: 'tag-wip',
  done: 'tag-ok',
};
const STATUSES: ProjectStatus[] = ['new', 'wip', 'done'];

export interface ProjectHeaderProps {
  projectName: string;
  onRename: (name: string) => void;
  status: ProjectStatus;
  onStatusChange: (status: ProjectStatus) => void;
  clientName?: string | null;
  updatedAt: number | string;
  readOnly: boolean;
  user: { name: string; email: string; plan?: string } | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
  onOpenProjectSettings: () => void;
  onPrint: () => void;
  onOpenAccount: () => void;
  onOpenPlan: () => void;
  /** Rouvre le tutoriel de prise en main */
  onOpenTutorial?: () => void;
  onLogout: () => void;
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuit', pro: 'Pro', team: 'Équipe' };

/** Ferme un menu au clic / toucher en dehors. */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open, close]);
  return ref;
}

const MenuItem = ({
  icon,
  children,
  onClick,
  danger = false,
  trailing,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors hover:bg-[var(--surf2)]"
    style={{ color: danger ? '#ef4444' : 'var(--text2)' }}
  >
    <span className="flex w-4 shrink-0 justify-center" aria-hidden>
      {icon}
    </span>
    <span className="min-w-0 flex-1">{children}</span>
    {trailing}
  </button>
);

const MenuDivider = () => <div className="my-1 h-px" style={{ background: 'var(--bdr)' }} />;

const menuBox = 'absolute right-0 top-full z-50 mt-1 rounded-xl p-1 shadow-xl';
const menuStyle = { background: 'var(--surf)', border: '1px solid var(--bdr)' };

/** Choix du statut : 3 pastilles, celle en cours cochée. */
const StatusChoices = ({
  status,
  onChange,
}: {
  status: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
}) => (
  <div className="flex flex-col">
    {STATUSES.map((s) => (
      <button
        key={s}
        type="button"
        role="menuitemradio"
        aria-checked={s === status}
        onClick={() => onChange(s)}
        className="flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-[12.5px] transition-colors hover:bg-[var(--surf2)]"
      >
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[s]}`}>
          {STATUS_LABELS[s]}
        </span>
        {s === status && <Check size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />}
      </button>
    ))}
  </div>
);

/**
 * En-tête de la page projet.
 * - Ordinateur : « Projets › nom » (renommable), statut en liste, client et date discrets,
 *   PDF, paramètres du projet, menu du compte (thème inclus).
 * - Smartphone : retour, nom du projet, statut, menu ⋯ regroupant toutes les actions.
 */
export const ProjectHeader = ({
  projectName,
  onRename,
  status,
  onStatusChange,
  clientName,
  updatedAt,
  readOnly,
  user,
  darkMode,
  onToggleDarkMode,
  onBack,
  onOpenProjectSettings,
  onPrint,
  onOpenAccount,
  onOpenPlan,
  onOpenTutorial,
  onLogout,
}: ProjectHeaderProps) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const statusRef = useOutside(statusOpen, () => setStatusOpen(false));
  const userRef = useOutside(userOpen, () => setUserOpen(false));
  const moreRef = useOutside(moreOpen, () => setMoreOpen(false));
  const nameRef = useRef<HTMLInputElement>(null);

  const initials =
    user?.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? 'CP';
  const date = new Date(updatedAt).toLocaleDateString('fr-FR');
  const run = (close: () => void, action: () => void) => () => {
    close();
    action();
  };
  const ThemeIcon = darkMode ? Sun : Moon;
  const themeLabel = darkMode ? 'Thème clair' : 'Thème sombre';

  return (
    <header className="shell-topbar gap-2 px-2 mouse:gap-3 mouse:px-4 md:gap-3 md:px-4">
      {/* Retour aux projets : logo (ordinateur) ou flèche (smartphone) */}
      {/* .btn-icon fixe display : on masque via un conteneur */}
      <span className="flex shrink-0 mouse:hidden md:hidden">
        <button type="button" onClick={onBack} aria-label="Retour aux projets" className="btn-icon">
          <ChevronLeft size={18} />
        </button>
      </span>
      <button
        type="button"
        onClick={onBack}
        title="Retour aux projets"
        className="hidden shrink-0 items-center gap-2 mouse:flex md:flex"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: 'var(--accent)' }}
          aria-hidden
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" />
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7" />
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7" />
            <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white" />
          </svg>
        </span>
        <span className="text-[12.5px] hover:underline" style={{ color: 'var(--text2)' }}>
          Projets
        </span>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }} aria-hidden>
          ›
        </span>
      </button>

      {/* Nom du projet (renommable sur place) */}
      <label
        className="group flex min-w-0 flex-1 items-center gap-1.5 mouse:flex-initial md:flex-initial"
        title={readOnly ? undefined : 'Renommer le projet'}
      >
        <input
          ref={nameRef}
          type="text"
          aria-label="Nom du projet"
          value={projectName}
          onChange={(e) => onRename(e.target.value)}
          readOnly={readOnly}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[14px] font-semibold outline-none transition-colors focus:border-[var(--bdr)] focus:bg-[var(--surf2)] mouse:max-w-[280px] md:max-w-[280px]"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}
        />
        {!readOnly && (
          <Pencil
            size={13}
            aria-hidden
            className="hidden shrink-0 opacity-0 transition-opacity group-hover:opacity-100 mouse:block md:block"
            style={{ color: 'var(--muted)' }}
          />
        )}
      </label>

      {/* Statut : liste déroulante */}
      <div className="relative shrink-0" ref={statusRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={statusOpen}
          aria-label={`Statut : ${STATUS_LABELS[status]}`}
          disabled={readOnly}
          onClick={() => setStatusOpen((o) => !o)}
          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100 ${STATUS_CLASS[status]}`}
        >
          {STATUS_LABELS[status]}
          {!readOnly && <ChevronDown size={12} aria-hidden />}
        </button>
        {statusOpen && (
          <div role="menu" className={`${menuBox} left-0 right-auto w-40`} style={menuStyle}>
            <StatusChoices
              status={status}
              onChange={(s) => {
                setStatusOpen(false);
                onStatusChange(s);
              }}
            />
          </div>
        )}
      </div>

      {/* Client et date (ordinateur) */}
      <span
        className="hidden min-w-0 truncate text-[12px] mouse:block md:block"
        style={{ color: 'var(--muted)' }}
      >
        {clientName ? `${clientName} · ` : ''}modifié le {date}
      </span>

      <span className="hidden flex-1 mouse:block md:block" />

      {/* Actions (ordinateur) */}
      <div className="hidden shrink-0 items-center gap-2 mouse:flex md:flex">
        <button
          type="button"
          onClick={onPrint}
          className="btn-secondary items-center gap-1.5 text-[12.5px]"
          style={{ padding: '5px 10px' }}
        >
          <FileDown size={13} /> PDF
        </button>
        <button
          type="button"
          onClick={onOpenProjectSettings}
          disabled={readOnly}
          aria-label="Paramètres du projet"
          title={readOnly ? 'Lecture seule' : 'Paramètres du projet'}
          className="btn-icon disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {/* Menu du compte (ordinateur) */}
      <div className="relative hidden shrink-0 mouse:block md:block" ref={userRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={userOpen}
          aria-label="Mon compte"
          onClick={() => setUserOpen((o) => !o)}
          className="flex items-center gap-2 rounded-[var(--rs)] px-2 py-1.5 transition-colors"
          style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {initials}
          </span>
          {user?.plan && (
            <span className="tag-pro rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
              {PLAN_LABEL[user.plan] ?? user.plan}
            </span>
          )}
        </button>
        {userOpen && (
          <div role="menu" className={`${menuBox} w-56`} style={menuStyle}>
            <div className="px-3 py-2">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {user?.name ?? 'Utilisateur'}
              </p>
              <p className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {user?.email ?? ''}
              </p>
            </div>
            <MenuDivider />
            <MenuItem icon={<ThemeIcon size={14} />} onClick={run(() => {}, onToggleDarkMode)}>
              {themeLabel}
            </MenuItem>
            <MenuItem
              icon={<Settings size={14} />}
              onClick={run(() => setUserOpen(false), onOpenAccount)}
            >
              Paramètres
            </MenuItem>
            <MenuItem
              icon={<CreditCard size={14} />}
              onClick={run(() => setUserOpen(false), onOpenPlan)}
            >
              Changer de forfait
            </MenuItem>
            {onOpenTutorial && (
              <MenuItem
                icon={<GraduationCap size={14} />}
                onClick={run(() => setUserOpen(false), onOpenTutorial)}
              >
                Tutoriel
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem
              icon={<LogOut size={13} />}
              danger
              onClick={run(() => setUserOpen(false), onLogout)}
            >
              Se déconnecter
            </MenuItem>
          </div>
        )}
      </div>

      {/* Menu ⋯ (smartphone) : toutes les actions */}
      <div className="relative shrink-0 mouse:hidden md:hidden" ref={moreRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          aria-label="Plus d’actions"
          onClick={() => setMoreOpen((o) => !o)}
          className="btn-icon"
        >
          <MoreHorizontal size={18} />
        </button>
        {moreOpen && (
          <div
            role="menu"
            className={`${menuBox} max-h-[75svh] w-64 overflow-y-auto`}
            style={menuStyle}
          >
            <div className="px-3 pb-1 pt-2">
              <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                {projectName}
              </p>
              <p className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {clientName ? `${clientName} · ` : ''}modifié le {date}
              </p>
            </div>
            {!readOnly && (
              <>
                <MenuItem
                  icon={<Pencil size={14} />}
                  onClick={run(
                    () => setMoreOpen(false),
                    () => nameRef.current?.focus(),
                  )}
                >
                  Renommer
                </MenuItem>
                <MenuItem
                  icon={<SlidersHorizontal size={14} />}
                  onClick={run(() => setMoreOpen(false), onOpenProjectSettings)}
                >
                  Paramètres du projet
                </MenuItem>
                <p
                  className="px-3 pb-0.5 pt-1.5 text-[10.5px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  Statut
                </p>
                <StatusChoices
                  status={status}
                  onChange={(s) => {
                    setMoreOpen(false);
                    onStatusChange(s);
                  }}
                />
              </>
            )}
            <MenuDivider />
            <MenuItem
              icon={<FileDown size={14} />}
              onClick={run(() => setMoreOpen(false), onPrint)}
            >
              Exporter en PDF
            </MenuItem>
            <MenuItem icon={<ThemeIcon size={14} />} onClick={onToggleDarkMode}>
              {themeLabel}
            </MenuItem>
            {onOpenTutorial && (
              <MenuItem
                icon={<GraduationCap size={14} />}
                onClick={run(() => setMoreOpen(false), onOpenTutorial)}
              >
                Tutoriel
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem
              icon={<User size={14} />}
              onClick={run(() => setMoreOpen(false), onOpenAccount)}
              trailing={
                user?.plan && (
                  <span className="tag-pro rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                    {PLAN_LABEL[user.plan] ?? user.plan}
                  </span>
                )
              }
            >
              Mon compte
            </MenuItem>
            <MenuItem
              icon={<LogOut size={13} />}
              danger
              onClick={run(() => setMoreOpen(false), onLogout)}
            >
              Se déconnecter
            </MenuItem>
          </div>
        )}
      </div>
    </header>
  );
};
