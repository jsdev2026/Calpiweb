'use client';

import { useEffect, type ReactNode } from 'react';
import { useUiStore } from '@/store/uiStore';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const init = useUiStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return <>{children}</>;
};
