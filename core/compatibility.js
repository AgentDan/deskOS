const { loadGraph } = require('../catalog/graph');

function assertCompatible(items, graph) {
  const selected = new Set(items);
  const byId = new Map(graph.map((node) => [node.id, node]));
  const conflicts = [];
  const suggestedSkus = [];
  const suggestedSet = new Set();
  const visited = new Set();

  function suggest(id) {
    if (!suggestedSet.has(id) && !selected.has(id)) {
      suggestedSet.add(id);
      suggestedSkus.push(id);
    }
  }

  function walk(id) {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);

    const node = byId.get(id);
    if (!node) {
      return;
    }

    for (const relation of node.relations) {
      const targetId = relation.targetId;

      if (relation.type === 'requires') {
        if (!selected.has(targetId)) {
          conflicts.push({
            element: id,
            reason: `requires missing ${targetId}`,
            missingId: targetId,
          });
          suggest(targetId);
          walk(targetId);
        }
      } else if (relation.type === 'mountedOn') {
        if (!selected.has(targetId)) {
          conflicts.push({
            element: id,
            reason: `must be mounted on ${targetId}`,
            missingId: targetId,
          });
          suggest(targetId);
          walk(targetId);
        }
      } else if (relation.type === 'incompatibleWith') {
        if (selected.has(targetId)) {
          conflicts.push({
            element: id,
            reason: `incompatible with ${targetId}`,
          });
        }
      }
    }
  }

  for (const id of items) {
    walk(id);
  }

  const result = {
    valid: conflicts.length === 0,
    conflicts,
    suggestedSkus,
  };

  console.log(
    `[compatibility] valid=${result.valid} conflicts=${result.conflicts.length} suggestedSkus=[${result.suggestedSkus.join(', ')}]`
  );

  return result;
}

function printDemo() {
  const graph = loadGraph();

  const validItems = [
    'desk_frame',
    'desk_top',
    'monitor_arm',
    'monitor',
    'keyboard',
    'mouse',
  ];
  const invalidItems = ['monitor'];

  console.log('=== valid configuration ===');
  console.log(JSON.stringify(assertCompatible(validItems, graph), null, 2));

  console.log('=== invalid configuration ===');
  console.log(JSON.stringify(assertCompatible(invalidItems, graph), null, 2));
}

module.exports = { assertCompatible };

if (require.main === module) {
  printDemo();
}
