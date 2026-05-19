// src/components/plan/ToolTooltip.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToolTooltipProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

export const ToolTooltip = ({ label, description, children }: ToolTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setPos({ top: r.top, left: r.right + 8 });
      }
      setVisible(true);
    }, 600);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div ref={wrapRef} data-testid="tooltip-wrapper" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-xl px-3 py-2 text-xs shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              background: 'var(--surf)',
              border: '1px solid var(--bdr)',
              maxWidth: 220,
            }}
          >
            <p className="mb-0.5 font-bold" style={{ color: 'var(--text)' }}>{label}</p>
            <p style={{ color: 'var(--text2)' }}>{description}</p>
          </div>,
          document.body,
        )}
    </div>
  );
};
