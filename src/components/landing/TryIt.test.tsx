import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { SIGNUP_URL, TryIt } from './TryIt';

// jsdom ne calcule pas la géométrie SVG : 1 px à l'écran = 10 mm dans la zone de dessin
beforeAll(() => {
  class FakePoint {
    constructor(
      public x: number,
      public y: number,
    ) {}
    matrixTransform() {
      return { x: this.x * 10, y: this.y * 10 };
    }
  }
  vi.stubGlobal('DOMPoint', FakePoint);
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ inverse: () => ({}) }),
  });
});
beforeEach(() => push.mockReset());

/** Clic dans la zone de dessin, en mm */
const click = (x: number, y: number) =>
  fireEvent.pointerDown(screen.getByTestId('try-canvas'), { clientX: x / 10, clientY: y / 10 });

const drawRoom = () => {
  click(1000, 1000);
  click(5000, 1000);
  click(5000, 4000);
  click(1000, 4000);
  click(1000, 1000); // retour au premier point : fermeture
};

describe('Essai sur la page d’accueil', () => {
  it('guide le tracé puis affiche le calepinage et le quantitatif', () => {
    render(<TryIt />);
    expect(screen.getByRole('status').textContent).toBe(
      'Cliquez pour poser le premier angle de la pièce',
    );
    click(1000, 1000);
    click(5000, 1000);
    click(5000, 4000);
    expect(screen.getByRole('status').textContent).toBe(
      'Cliquez sur le premier point pour fermer la pièce',
    );
    click(1000, 4000);
    click(1000, 1000);
    expect(screen.getByRole('status').textContent).toBe('Votre quantitatif est prêt · 12,00 m²');

    const q = screen.getByTestId('try-quantities');
    // 4 m × 3 m = 12 m², carreaux 60×60
    expect(q.textContent).toContain('12,00 m²');
    expect(q.textContent).toMatch(/carreaux 60×60/);
    expect(Number(within(q).getByTestId('try-to-order').textContent)).toBeGreaterThan(30);
    expect(screen.getByRole('button', { name: 'Enregistrer mon projet — gratuit' })).toBeTruthy();
  });

  it('un seul format et un seul outil : le reste renvoie vers l’inscription', () => {
    render(<TryIt />);
    for (const name of [
      '30×60 (inscription requise)',
      'Porte (inscription requise)',
      'Décalée (inscription requise)',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(push).toHaveBeenCalledTimes(3);
    expect(push).toHaveBeenCalledWith(SIGNUP_URL);
    // L'option active ne déclenche rien
    fireEvent.click(screen.getByRole('button', { name: '60×60' }));
    expect(push).toHaveBeenCalledTimes(3);
  });

  it('options du quantitatif verrouillées (cartons, PDF…)', () => {
    render(<TryIt />);
    drawRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF (inscription requise)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cartons (inscription requise)' }));
    expect(push).toHaveBeenCalledTimes(2);
    expect(SIGNUP_URL).toBe('/auth?step=register&from=essai');
  });

  it('refuse les murs qui se croisent, annule et recommence', () => {
    render(<TryIt />);
    click(1000, 1000);
    click(5000, 1000);
    click(5000, 4000);
    click(3000, 0); // croise le premier mur
    expect(screen.getByRole('status').textContent).toBe('Les murs ne peuvent pas se croiser');
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le point' }));
    expect(screen.getByRole('status').textContent).toBe('Cliquez pour poser l’angle suivant');
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    expect(screen.getByRole('status').textContent).toBe(
      'Cliquez pour poser le premier angle de la pièce',
    );
  });
});
