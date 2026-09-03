const { loadGraph } = require('../catalog/graph');
const { solve } = require('../core/solver');
const fs = require('fs');
const path = require('path');

function loadManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'manifest', 'workspace.json'), 'utf8')
  );
}

describe('solve', () => {
  const graph = loadGraph();
  const manifest = loadManifest();

  it('solves a valid desk configuration', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor',
      'keyboard',
      'mouse',
    ];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('solved');
    const placedIds = result.placements.map((placement) => placement.elementId);
    expect(placedIds).toEqual(
      expect.arrayContaining([
        'desk_frame',
        'desk_top',
        'monitor_arm',
        'monitor',
        'keyboard',
        'mouse',
      ])
    );
    expect(result.placements).toHaveLength(6);
  });

  it('places two monitor arms on two different anchors', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor_arm',
      'monitor',
      'monitor',
    ];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('solved');
    const armAnchorIds = result.placements
      .filter((placement) => placement.elementId === 'monitor_arm')
      .map((placement) => placement.anchorId);
    expect(armAnchorIds).toHaveLength(2);
    expect(new Set(armAnchorIds).size).toBe(2);
  });

  it('fails when a third monitor has no remaining arm', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor_arm',
      'monitor',
      'monitor',
      'monitor',
    ];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('unsolvable');
    expect(result.violated.some((item) => item.constraint === 'non_overlap' || item.constraint === 'support')).toBe(
      true
    );
  });

  it('returns SceneFailure for an element without a matching anchor', () => {
    const items = ['desk_frame', 'desk_top', 'drawer', 'drawer'];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('unsolvable');
    expect(result.violated.length).toBeGreaterThan(0);
    expect(result.suggestRemove).toContain('drawer');
  });

  it('does not take preferences as an argument', () => {
    expect(solve.length).toBe(3);
  });
});
