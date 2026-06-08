import { describe, it, expect } from 'vitest';
import { splitWallInEngine, connectNodeToWallInEngine, updateExcludeZoneNodeInEngine } from './projectStore';
import type { Wall, WallNode, ExcludeNode, WallExcludedZone } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

describe('splitWallInEngine', () => {
  const nodes = [nd('a', 0, 0), nd('b', 200, 0)];
  const wall: Wall = { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 100 };
  const we = { nodes, walls: [wall], excludedZones: [] };

  it('ajoute le nœud de split', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.find(n => n.id === 'm')).toEqual({ id: 'm', x: 100, y: 0 });
  });

  it('supprime le mur original et ajoute deux murs', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.walls).toHaveLength(2);
    expect(result.walls.find(w => w.id === 'w1')).toBeUndefined();
  });

  it('les deux nouveaux murs relient les extrémités via le nœud de split', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    const first  = result.walls.find(w => w.node1Id === 'a');
    const second = result.walls.find(w => w.node1Id === 'm');
    expect(first?.node2Id).toBe('m');
    expect(second?.node2Id).toBe('b');
  });

  it('préserve l\'épaisseur sur les deux murs', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    result.walls.forEach(w => expect(w.thickness).toBe(100));
  });

  it('préserve excludedZones inchangé', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.excludedZones).toEqual([]);
  });

  it('retourne le même objet si wallId introuvable', () => {
    const result = splitWallInEngine(we, 'missing', nd('m', 100, 0));
    expect(result).toBe(we);
  });

  it('préserve isDoor sur les deux murs fils', () => {
    const doorWall: Wall = { id: 'dw', node1Id: 'a', node2Id: 'b', thickness: 100, isDoor: true };
    const doorWe = { nodes, walls: [doorWall], excludedZones: [] };
    const result = splitWallInEngine(doorWe, 'dw', nd('m', 100, 0));
    result.walls.forEach(w => expect(w.isDoor).toBe(true));
  });
});

describe('connectNodeToWallInEngine', () => {
  const nodes = [nd('a', 0, 0), nd('b', 200, 0), nd('free', 100, 500)];
  const wall: Wall = { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 100 };
  const we = { nodes, walls: [wall], excludedZones: [] };

  it('déplace le nœud existant vers newPos', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    const moved = result.nodes.find(n => n.id === 'free');
    expect(moved).toEqual({ id: 'free', x: 100, y: 0 });
  });

  it('ne crée pas de nouveau nœud — le nombre reste identique', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    expect(result.nodes).toHaveLength(3);
  });

  it('supprime le mur original et crée deux sous-murs', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    expect(result.walls).toHaveLength(2);
    expect(result.walls.find(w => w.id === 'w1')).toBeUndefined();
  });

  it('les deux sous-murs relient a → free et free → b', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    const w1 = result.walls.find(w => w.node1Id === 'a');
    const w2 = result.walls.find(w => w.node1Id === 'free');
    expect(w1?.node2Id).toBe('free');
    expect(w2?.node2Id).toBe('b');
  });

  it('préserve l\'épaisseur sur les deux sous-murs', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    result.walls.forEach(w => expect(w.thickness).toBe(100));
  });

  it('préserve excludedZones inchangé', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    expect(result.excludedZones).toEqual([]);
  });

  it('retourne le même objet si wallId introuvable', () => {
    const result = connectNodeToWallInEngine(we, 'missing', 'free', { x: 100, y: 0 });
    expect(result).toBe(we);
  });

  it('retourne le même objet si nodeId introuvable', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'ghost', { x: 100, y: 0 });
    expect(result).toBe(we);
  });

  it('préserve isDoor sur les deux sous-murs', () => {
    const doorWall: Wall = { id: 'dw', node1Id: 'a', node2Id: 'b', thickness: 100, isDoor: true };
    const doorWe = { nodes, walls: [doorWall], excludedZones: [] };
    const result = connectNodeToWallInEngine(doorWe, 'dw', 'free', { x: 100, y: 0 });
    result.walls.forEach(w => expect(w.isDoor).toBe(true));
  });
});

describe('updateExcludeZoneNodeInEngine', () => {
  const zone: WallExcludedZone = {
    id: 'z1',
    nodes: [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 100, y: 0 },
      { id: 'n3', x: 100, y: 100 },
    ],
  };
  const we = { nodes: [], walls: [], excludedZones: [zone] };

  it('met à jour la position du nœud ciblé', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'z1', 'n2', { x: 150, y: 50 });
    const updated = result.excludedZones.find(z => z.id === 'z1')!;
    const n2 = updated.nodes.find(n => n.id === 'n2')!;
    expect(n2.x).toBe(150);
    expect(n2.y).toBe(50);
  });

  it('ne modifie pas les autres nœuds', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'z1', 'n2', { x: 150, y: 50 });
    const updated = result.excludedZones.find(z => z.id === 'z1')!;
    expect(updated.nodes.find(n => n.id === 'n1')).toMatchObject({ x: 0, y: 0 });
    expect(updated.nodes.find(n => n.id === 'n3')).toMatchObject({ x: 100, y: 100 });
  });

  it('ne modifie pas les autres zones', () => {
    const zone2: WallExcludedZone = { id: 'z2', nodes: [{ id: 'a', x: 0, y: 0 }] };
    const we2 = { nodes: [], walls: [], excludedZones: [zone, zone2] };
    const result = updateExcludeZoneNodeInEngine(we2, 'z1', 'n1', { x: 99, y: 99 });
    expect(result.excludedZones.find(z => z.id === 'z2')).toBe(zone2);
  });

  it('retourne we inchangé si zoneId introuvable', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'MISSING', 'n1', { x: 1, y: 1 });
    expect(result).toBe(we);
  });
});
