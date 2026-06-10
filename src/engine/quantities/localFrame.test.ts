// src/engine/quantities/localFrame.test.ts
import { describe, it, expect } from 'vitest';
import { localFrameFromPoints } from './localFrame';

describe('localFrameFromPoints', () => {
  // CHEVRON tile: Largeur (eW) = 300mm, Longueur (eH) = 600mm, angle = 45°
  const span = 600 * Math.cos(Math.PI / 4);
  const dy = 600 * Math.sin(Math.PI / 4);
  const points = [
    { x: 0, y: 0 },
    { x: span, y: dy },
    { x: span, y: dy + 300 },
    { x: 0, y: 300 },
  ];

  it('Wlen = |eW| = 300, Hlen = |eH| = 600', () => {
    const frame = localFrameFromPoints(points);
    expect(frame.Wlen).toBeCloseTo(300, 6);
    expect(frame.Hlen).toBeCloseTo(600, 6);
  });

  it('toLocal maps the four corners onto the local rectangle [0,Wlen]×[0,Hlen]', () => {
    const frame = localFrameFromPoints(points);
    const p0 = frame.toLocal(points[0]!);
    const p1 = frame.toLocal(points[1]!);
    const p2 = frame.toLocal(points[2]!);
    const p3 = frame.toLocal(points[3]!);
    expect(p0.x).toBeCloseTo(0, 6);   expect(p0.y).toBeCloseTo(0, 6);
    expect(p1.x).toBeCloseTo(0, 6);   expect(p1.y).toBeCloseTo(600, 6);
    expect(p2.x).toBeCloseTo(300, 6); expect(p2.y).toBeCloseTo(600, 6);
    expect(p3.x).toBeCloseTo(300, 6); expect(p3.y).toBeCloseTo(0, 6);
  });

  it('toGlobal is the inverse of toLocal', () => {
    const frame = localFrameFromPoints(points);
    const probe = { x: 123.4, y: -56.7 };
    const back = frame.toGlobal(frame.toLocal(probe));
    expect(back.x).toBeCloseTo(probe.x, 6);
    expect(back.y).toBeCloseTo(probe.y, 6);
  });
});
