// src/components/plan/useDraggableSnap.test.ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useDraggableSnap } from './useDraggableSnap';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth',  { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
});

describe('useDraggableSnap', () => {
  it('initialise avec defaultZone si localStorage vide', () => {
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'BOTTOM' }),
    );
    expect(result.current.zone).toBe('BOTTOM');
  });

  it('restaure la zone depuis localStorage', () => {
    localStorage.setItem('test-zone', 'TOP');
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'BOTTOM' }),
    );
    expect(result.current.zone).toBe('TOP');
  });

  it('isDragging est false et nearestZone est null au départ', () => {
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'SIDE' }),
    );
    expect(result.current.isDragging).toBe(false);
    expect(result.current.nearestZone).toBeNull();
  });
});
