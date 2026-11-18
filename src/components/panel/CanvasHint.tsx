'use client';

import { usePanelStore } from '@/store/panelStore';

/**
 * Message d'aide posé en haut du plan, même style dans les trois modes.
 * Centré dans la zone visible : sur ordinateur, décalé de la moitié du panneau latéral.
 * - `info` : discret (outil actif, gestes) ;
 * - `action` : orange, avec un bouton (ex. « Annuler » pendant un choix sur le plan).
 */
export const CanvasHint = ({
  children,
  tone = 'info',
  action,
  desktopOnly = false,
  testId,
}: {
  children: React.ReactNode;
  tone?: 'info' | 'action';
  action?: { label: string; onClick: () => void };
  desktopOnly?: boolean;
  testId?: string;
}) => {
  const collapsed = usePanelStore((s) => s.collapsed);
  const offset = collapsed
    ? 'mouse:left-[calc(50%+34px)] md:left-[calc(50%+34px)]'
    : 'mouse:left-[calc(50%+156px)] md:left-[calc(50%+156px)]';
  const isAction = tone === 'action';
  return (
    <div
      role="status"
      data-testid={testId}
      className={`absolute left-1/2 top-3 z-30 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full text-[12.5px] shadow-md ${offset} ${
        desktopOnly ? 'hidden mouse:flex md:flex' : 'flex'
      } ${isAction ? 'py-1.5 pl-3.5 pr-1.5 font-semibold text-white' : 'pointer-events-none px-3.5 py-1.5 font-medium'}`}
      style={
        isAction
          ? { background: 'var(--accent)' }
          : { background: 'var(--surf)', border: '1px solid var(--bdr)', color: 'var(--text2)' }
      }
    >
      {children}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-full bg-white/25 px-2.5 py-1 text-[12px] font-semibold hover:bg-white/35"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
