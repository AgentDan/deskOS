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

  it('solves a desk with one monitor', () => {
    const items = ['desk_top', 'monitor'];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('solved');
    const placedIds = result.placements.map((placement) => placement.elementId);
    expect(placedIds).toEqual(expect.arrayContaining(['desk_top', 'monitor']));
    expect(result.placements).toHaveLength(2);
  });

  it('places two monitors on two different anchors', () => {
    const items = ['desk_top', 'monitor', 'monitor'];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('solved');
    const monitorAnchorIds = result.placements
      .filter((placement) => placement.elementId === 'monitor')
      .map((placement) => placement.anchorId);
    expect(monitorAnchorIds).toHaveLength(2);
    expect(new Set(monitorAnchorIds).size).toBe(2);
  });

  it('fails when a fourth monitor has no remaining anchor', () => {
    const items = ['desk_top', 'monitor', 'monitor', 'monitor', 'monitor'];
    const result = solve(items, graph, manifest);

    expect(result.status).toBe('unsolvable');
    expect(
      result.violated.some(
        (item) => item.constraint === 'non_overlap' || item.constraint === 'support'
      )
    ).toBe(true);
  });

  it('does not take preferences as an argument', () => {
    expect(solve.length).toBe(3);
  });
});
