import { describe, expect, it } from 'vitest';
import { canCreateProject, ownedProjects, projectLimit } from './entitlements';

const own = { myRole: 'owner' as const };
const legacy = { myRole: undefined };
const shared = { myRole: 'editor' as const };
const viewer = { myRole: 'viewer' as const };

describe('entitlements', () => {
  it('ne compte que les projets possédés', () => {
    expect(ownedProjects([own, legacy, shared, viewer])).toHaveLength(2);
  });

  it('limite gratuite = 1 + crédits', () => {
    expect(projectLimit({ plan: 'free', projectCredits: 0 })).toBe(1);
    expect(projectLimit({ plan: 'free', projectCredits: 2 })).toBe(3);
    expect(projectLimit({ plan: 'pro', projectCredits: 0 })).toBe(Infinity);
  });

  it('un utilisateur gratuit invité sur un projet peut créer le sien', () => {
    expect(canCreateProject({ plan: 'free', projectCredits: 0 }, [shared, viewer])).toBe(true);
  });

  it('bloque au-delà de la limite gratuite', () => {
    expect(canCreateProject({ plan: 'free', projectCredits: 0 }, [own])).toBe(false);
  });

  it('un crédit débloque un projet de plus', () => {
    expect(canCreateProject({ plan: 'free', projectCredits: 1 }, [own])).toBe(true);
    expect(canCreateProject({ plan: 'free', projectCredits: 1 }, [own, own])).toBe(false);
  });

  it('pro : illimité', () => {
    expect(canCreateProject({ plan: 'pro', projectCredits: 0 }, [own, own, own])).toBe(true);
  });
});
