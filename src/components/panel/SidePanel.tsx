'use client';

import { Fragment } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, PanelLeftClose } from 'lucide-react';
import { usePanelStore } from '@/store/panelStore';
import { ToolTooltip } from '@/components/plan/ToolTooltip';

/**
 * Panneau latéral commun aux modes Plan 2D, Calepinage et Quantitatif.
 *
 * - Ordinateur : à gauche, sur toute la hauteur du plan ; déplié (300 px) ou replié
 *   en barre d'icônes (56 px). L'état est partagé par les trois modes et mémorisé.
 * - Smartphone : en bas de l'écran, en-tête et liens précédent / suivant toujours visibles,
 *   contenu déplié d'une touche.
 *
 * Même anatomie partout : en-tête (icône du mode, titre, résumé), barre optionnelle
 * toujours visible (outils du Plan 2D), sections titrées, pied optionnel.
 */

export const PANEL_WIDTH = 300;
export const PANEL_RAIL_WIDTH = 56;

export interface RailItem {
  id: string;
  label: string;
  /** Description affichée dans l'infobulle de la barre repliée */
  description?: string;
  icon: React.ReactNode;
  active?: boolean;
  /** Rouge réservé à la suppression */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Séparateur avant cet élément */
  divider?: boolean;
  /** Fait légèrement pulser l'icône (aide à la découverte) */
  pulse?: boolean;
  /** Action directe (ex. choisir un outil). Sinon : déplie le panneau sur la section `id`. */
  onClick?: () => void;
}

export interface SidePanelProps {
  testId?: string;
  /** Icône du mode (lucide, 18 px) */
  icon: React.ReactNode;
  title: string;
  /** Ligne de résumé sous le titre (outil actif, carreau, surface…) */
  summary?: React.ReactNode;
  /** Contenu toujours visible sous l'en-tête, même panneau replié sur smartphone */
  bar?: React.ReactNode;
  /** Raccourcis de la barre d'icônes (ordinateur, panneau replié) */
  railItems?: RailItem[];
  /** Lien vers l'étape suivante (Plan 2D → Calepinage → Quantitatif → PDF), en haut du panneau */
  next?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    /** Grisé (ex. aucune pièce fermée) : le clic reste possible pour expliquer pourquoi */
    disabled?: boolean;
  };
  /** Lien vers l'étape précédente (Calepinage → Plan 2D, Quantitatif → Calepinage) */
  prev?: { label: string; onClick: () => void };
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export const sectionDomId = (id: string) => `panel-section-${id}`;

export const SidePanel = ({
  testId,
  icon,
  title,
  summary,
  bar,
  railItems = [],
  next,
  prev,
  footer,
  children,
}: SidePanelProps) => {
  const collapsed = usePanelStore((s) => s.collapsed);
  const setCollapsed = usePanelStore((s) => s.setCollapsed);
  const mobileOpen = usePanelStore((s) => s.mobileOpen);
  const setMobileOpen = usePanelStore((s) => s.setMobileOpen);
  const navLearned = usePanelStore((s) => s.navLearned);
  const markNavLearned = usePanelStore((s) => s.markNavLearned);
  const goPrev = prev
    ? () => {
        markNavLearned();
        prev.onClick();
      }
    : undefined;
  const goNext = next
    ? () => {
        if (!next.disabled) markNavLearned();
        next.onClick();
      }
    : undefined;
  // Pulsation discrète du lien « suivant » tant que l'utilisateur ne s'en est jamais servi
  const pulseNext = !!next && !next.disabled && !navLearned;

  const expandTo = (sectionId?: string) => {
    setCollapsed(false);
    if (!sectionId) return;
    requestAnimationFrame(() =>
      document.getElementById(sectionDomId(sectionId))?.scrollIntoView({ block: 'start' }),
    );
  };

  // Desktop : on masque la barre d'icônes ou le contenu selon l'état replié
  const desk = (showWhenCollapsed: boolean) =>
    collapsed === showWhenCollapsed ? 'mouse:flex md:flex' : 'mouse:hidden md:hidden';

  return (
    <aside
      data-testid={testId}
      data-canvas-overlay
      data-collapsed={collapsed}
      aria-label={title}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t mouse:inset-x-auto mouse:bottom-3 mouse:left-3 mouse:top-3 mouse:rounded-2xl mouse:border md:inset-x-auto md:bottom-3 md:left-3 md:top-3 md:rounded-2xl md:border ${
        collapsed ? 'mouse:w-[56px] md:w-[56px]' : 'mouse:w-[300px] md:w-[300px]'
      }`}
      style={{
        background: 'var(--surf)',
        borderColor: 'var(--bdr)',
        boxShadow: 'var(--sh-lg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── En-tête (déplié sur ordinateur, toujours sur smartphone) ── */}
      <div className={`flex shrink-0 items-center ${desk(false)}`}>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          className="flex min-w-0 flex-1 flex-col items-stretch px-3 pb-2 pt-1.5 text-left mouse:cursor-default mouse:pt-2.5 md:cursor-default md:pt-2.5"
        >
          <span
            className="mx-auto mb-1.5 h-1 w-10 rounded-full mouse:hidden md:hidden"
            style={{ background: 'var(--bdr)' }}
          />
          <span className="flex items-center gap-2.5">
            <span className="flex shrink-0" style={{ color: 'var(--accent)' }} aria-hidden>
              {icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                {title}
              </span>
              {summary && (
                <span className="truncate text-[12px]" style={{ color: 'var(--muted)' }}>
                  {summary}
                </span>
              )}
            </span>
            <span className="shrink-0 mouse:hidden md:hidden" style={{ color: 'var(--muted)' }}>
              {mobileOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Replier le panneau"
          title="Replier le panneau"
          onClick={() => setCollapsed(true)}
          className="mr-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surf3)] mouse:flex md:flex"
          style={{ color: 'var(--muted)' }}
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* ── Barre d'icônes (ordinateur, panneau replié) ── */}
      <nav
        aria-label={`${title} — raccourcis`}
        className={`hidden flex-col items-center gap-1 overflow-y-auto py-2 ${desk(true)}`}
        style={{ scrollbarWidth: 'none' }}
      >
        <ToolTooltip label={title} description="Déplier le panneau">
          <button
            type="button"
            aria-label="Déplier le panneau"
            onClick={() => expandTo()}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surf3)]"
            style={{ color: 'var(--accent)' }}
          >
            {icon}
          </button>
        </ToolTooltip>
        {railItems.length > 0 && <PanelDivider />}
        {(
          [
            ...railItems,
            ...(prev
              ? [
                  {
                    id: 'prev',
                    label: prev.label,
                    icon: <ArrowLeft size={16} />,
                    onClick: goPrev,
                    divider: true,
                  },
                ]
              : []),
            ...(next
              ? [
                  {
                    id: 'next',
                    label: next.label,
                    icon: next.icon ?? <ArrowRight size={16} />,
                    onClick: goNext,
                    disabled: next.disabled,
                    pulse: pulseNext,
                    divider: !prev,
                  },
                ]
              : []),
          ] as RailItem[]
        ).map((item) => (
          <Fragment key={item.id}>
            {item.divider && <PanelDivider />}
            <ToolTooltip label={item.label} description={item.description ?? ''}>
              <IconToolButton
                label={item.label}
                icon={item.icon}
                active={item.active}
                tone={item.tone}
                disabled={item.disabled}
                className={item.pulse ? 'nav-pulse' : undefined}
                onClick={item.onClick ?? (() => expandTo(item.id))}
              />
            </ToolTooltip>
          </Fragment>
        ))}
      </nav>

      {(next || prev) && (
        <div
          data-panel-next
          // Toujours visible sur smartphone, même panneau replié
          className={`flex shrink-0 items-center gap-2 border-y px-3 py-1.5 ${desk(false)}`}
          style={{ borderColor: 'var(--bdr)', background: 'var(--surf2)' }}
        >
          {prev && (
            <button
              type="button"
              onClick={goPrev}
              className="-ml-2 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <ArrowLeft size={14} aria-hidden />
              {prev.label}
            </button>
          )}
          <span className="flex-1" />
          {next && (
            <button
              type="button"
              onClick={goNext}
              aria-disabled={next.disabled || undefined}
              data-pulse={pulseNext || undefined}
              className={`-mr-2 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold underline-offset-2 ${
                next.disabled ? 'cursor-help' : 'hover:underline'
              } ${pulseNext ? 'nav-pulse' : ''}`}
              style={{ color: next.disabled ? 'var(--muted)' : 'var(--accent)' }}
            >
              {next.label}
              {next.icon ?? <ArrowRight size={14} aria-hidden />}
            </button>
          )}
        </div>
      )}

      {bar && (
        <div className={`shrink-0 px-3 pb-2 ${next || prev ? 'pt-2' : ''} ${desk(false)}`}>
          {bar}
        </div>
      )}

      {/* ── Contenu ── */}
      {children && (
        <div
          data-panel-body
          data-open={mobileOpen}
          className={`${mobileOpen ? 'flex' : 'hidden'} max-h-[46svh] min-h-0 flex-col gap-4 overflow-y-auto border-t px-3 pb-3 pt-3 mouse:max-h-none mouse:flex-1 md:max-h-none md:flex-1 ${desk(false)}`}
          style={{ borderColor: 'var(--bdr)' }}
        >
          {children}
        </div>
      )}

      {footer && (
        <div
          className={`shrink-0 border-t px-3 py-2.5 ${mobileOpen ? 'flex' : 'hidden'} ${desk(false)}`}
          style={{ borderColor: 'var(--bdr)' }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
};

// ── Éléments communs ─────────────────────────────────────────────────────────

export const PanelDivider = () => (
  <div className="mx-auto h-px w-6 shrink-0" style={{ background: 'var(--bdr)' }} />
);

/** Section titrée du panneau ; `id` sert de cible aux raccourcis de la barre repliée. */
export const PanelSection = ({
  id,
  title,
  aside,
  children,
}: {
  id?: string;
  title: string;
  /** Élément aligné à droite du titre (bouton secondaire, valeur…) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section id={id ? sectionDomId(id) : undefined} className="flex scroll-mt-2 flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <h3
        className="text-[10.5px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--muted)' }}
      >
        {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

const activeStyle: React.CSSProperties = {
  borderColor: 'var(--accent)',
  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
  color: 'var(--accent)',
};
const idleStyle: React.CSSProperties = {
  borderColor: 'var(--bdr)',
  background: 'var(--surf2)',
  color: 'var(--text2)',
};
const dangerStyle: React.CSSProperties = {
  borderColor: '#ef4444',
  background: 'color-mix(in srgb, #ef4444 12%, transparent)',
  color: '#dc2626',
};

/** Style d'un choix (actif / neutre), pour les boutons sur mesure (vignettes de pose…) */
export const panelChipStyle = (active: boolean): React.CSSProperties =>
  active ? activeStyle : idleStyle;

type Tone = 'default' | 'danger';
const styleOf = (active: boolean | undefined, tone: Tone) =>
  active ? (tone === 'danger' ? dangerStyle : activeStyle) : idleStyle;

/** Choix compact (format, joint, pose…) : actif = orange, sinon neutre. */
export const PanelChip = ({
  active = false,
  onClick,
  children,
  ariaLabel,
  title,
  disabled,
  size = 'md',
  className = '',
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  /** sm : grilles compactes (formats…) */
  size?: 'sm' | 'md';
  className?: string;
}) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={ariaLabel}
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-semibold transition-colors active:scale-95 disabled:opacity-50 ${
      size === 'sm' ? 'h-8 px-1 text-[12px]' : 'h-9 px-2.5 text-[12.5px]'
    } ${className}`}
    style={styleOf(active, 'default')}
  >
    {children}
  </button>
);

/** Outil avec icône et libellé (panneau déplié). Rouge réservé à la suppression. */
export const PanelToolButton = ({
  label,
  icon,
  active = false,
  tone = 'default',
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  tone?: Tone;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className="flex h-10 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors active:scale-95 disabled:opacity-40"
    style={styleOf(active, tone)}
  >
    <span className="flex shrink-0" aria-hidden>
      {icon}
    </span>
    <span className="truncate">{label}</span>
  </button>
);

/** Outil icône seule (barre repliée, barre d'outils smartphone). */
export const IconToolButton = ({
  label,
  icon,
  active = false,
  tone = 'default',
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  tone?: Tone;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 disabled:opacity-40 ${className}`}
    style={
      active
        ? styleOf(true, tone)
        : { ...idleStyle, borderColor: 'transparent', background: 'transparent' }
    }
  >
    {icon}
  </button>
);
