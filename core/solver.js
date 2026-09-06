const fs = require('fs');
const path = require('path');
const { loadGraph } = require('../catalog/graph');
const { assertCompatible } = require('./compatibility');

const ZERO_ROTATION = { x: 0, y: 0, z: 0 };

function cloneAnchors(anchors) {
  return (anchors ?? []).map((anchor) => ({
    id: anchor.id,
    position: { ...anchor.position },
    direction: { ...anchor.direction },
    allowedTypes: [...anchor.allowedTypes],
    occupiedBy: undefined,
  }));
}

function fail(constraint, elements, message) {
  const result = {
    status: 'unsolvable',
    violated: [{ constraint, elements, message }],
    suggestRemove: [...elements],
  };

  console.log(
    `[solver] status=${result.status} violated=${constraint} suggestRemove=[${result.suggestRemove.join(', ')}]`
  );

  return result;
}

function fitsDesk(position, dimensions, deskWidth, deskDepth, maxHeightMm) {
  return (
    position.x + dimensions.width / 2 <= deskWidth &&
    position.z + dimensions.depth / 2 <= deskDepth &&
    position.y + dimensions.height <= maxHeightMm
  );
}

function findStackHost(node, placements, byId, usedHostKeys) {
  for (const placement of placements) {
    if (placement.anchorId === 'base') {
      continue;
    }
    const hostKey = `${placement.elementId}@${placement.anchorId}`;
    if (usedHostKeys.has(hostKey)) {
      continue;
    }

    const host = byId.get(placement.elementId);
    const provided = host.anchorsProvided ?? [];
    const canHold = provided.some((anchor) => anchor.allowedTypes.includes(node.type));
    if (canHold) {
      return { placement, host, hostKey };
    }
  }

  return null;
}

function solve(items, graph, manifest) {
  const byId = new Map(graph.map((node) => [node.id, node]));
  const deskTop = manifest.elements.find((element) => element.id === 'desk_top');
  const slots = cloneAnchors(deskTop.anchors);
  const deskWidth = deskTop.dimensions.width;
  const deskDepth = deskTop.dimensions.depth;
  const maxHeightMm = manifest.scene.maxHeightMm;

  const allowedOnDesk = new Set(slots.flatMap((slot) => slot.allowedTypes));
  const placements = [];
  const usedHostKeys = new Set();
  const satisfiedConstraints = [];

  const orderedIds = [];
  const deferredIds = [];

  for (const elementId of items) {
    const node = byId.get(elementId);
    if (!node) {
      return fail('support', [elementId], `Unknown element: ${elementId}`);
    }
    if (
      allowedOnDesk.has(node.type) ||
      node.type === 'desk_top' ||
      node.type === 'desk_frame'
    ) {
      orderedIds.push(elementId);
    } else {
      deferredIds.push(elementId);
    }
  }

  for (const elementId of [...orderedIds, ...deferredIds]) {
    const node = byId.get(elementId);
    const canSitOnDesk = allowedOnDesk.has(node.type);

    if (!canSitOnDesk) {
      const stackHost = findStackHost(node, placements, byId, usedHostKeys);
      if (!stackHost) {
        if (node.type === 'desk_top' || node.type === 'desk_frame') {
          const position = {
            x: node.dimensions.width / 2,
            y:
              node.type === 'desk_frame'
                ? -node.dimensions.height / 2
                : node.dimensions.height / 2,
            z: node.dimensions.depth / 2,
          };
          placements.push({
            elementId,
            anchorId: 'base',
            position,
            rotation: { ...ZERO_ROTATION },
          });
          continue;
        }
        return fail(
          'support',
          [elementId],
          `No supporting anchor for ${elementId}`
        );
      }

      const position = {
        x: stackHost.placement.position.x,
        y: stackHost.placement.position.y + stackHost.host.dimensions.height,
        z: stackHost.placement.position.z,
      };

      if (!fitsDesk(position, node.dimensions, deskWidth, deskDepth, maxHeightMm)) {
        return fail(
          'desk_bounds',
          [elementId],
          `${elementId} exceeds desk bounds`
        );
      }

      usedHostKeys.add(stackHost.hostKey);
      placements.push({
        elementId,
        anchorId: `${stackHost.placement.anchorId}/${node.type}`,
        position,
        rotation: { ...ZERO_ROTATION },
      });
      continue;
    }

    const matching = slots.filter((slot) => slot.allowedTypes.includes(node.type));
    const freeAnchor = matching.find((slot) => !slot.occupiedBy);

    if (!freeAnchor) {
      const stackHost = findStackHost(node, placements, byId, usedHostKeys);
      if (stackHost) {
        const position = {
          x: stackHost.placement.position.x,
          y: stackHost.placement.position.y + stackHost.host.dimensions.height,
          z: stackHost.placement.position.z,
        };

        if (!fitsDesk(position, node.dimensions, deskWidth, deskDepth, maxHeightMm)) {
          return fail(
            'desk_bounds',
            [elementId],
            `${elementId} exceeds desk bounds`
          );
        }

        usedHostKeys.add(stackHost.hostKey);
        placements.push({
          elementId,
          anchorId: `${stackHost.placement.anchorId}/${node.type}`,
          position,
          rotation: { ...ZERO_ROTATION },
        });
        continue;
      }

      if (matching.length > 0) {
        return fail(
          'non_overlap',
          [elementId],
          `No free anchor left for ${elementId}`
        );
      }

      return fail(
        'support',
        [elementId],
        `No supporting anchor for ${elementId}`
      );
    }

    if (!fitsDesk(freeAnchor.position, node.dimensions, deskWidth, deskDepth, maxHeightMm)) {
      return fail(
        'desk_bounds',
        [elementId],
        `${elementId} exceeds desk bounds at ${freeAnchor.id}`
      );
    }

    freeAnchor.occupiedBy = elementId;
    placements.push({
      elementId,
      anchorId: freeAnchor.id,
      position: { ...freeAnchor.position },
      rotation: { ...ZERO_ROTATION },
    });
  }

  satisfiedConstraints.push('support', 'non_overlap', 'desk_bounds');

  const result = {
    status: 'solved',
    placements,
    satisfiedConstraints,
    droppedPreferences: [],
  };

  console.log(
    `[solver] status=${result.status} placements=${result.placements.length}`
  );

  return result;
}

function loadManifest() {
  const manifestPath = path.join(__dirname, '..', 'manifest', 'workspace.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function printDemo() {
  const graph = loadGraph();
  const manifest = loadManifest();

  const config1 = ['desk_top', 'monitor'];
  const config2 = ['desk_top', 'monitor', 'monitor', 'monitor', 'monitor'];

  console.log('Конфигурация 1: стол + монитор');
  if (assertCompatible(config1, graph).valid) {
    console.log(JSON.stringify(solve(config1, graph, manifest), null, 2));
  }

  console.log('Конфигурация 2: четыре монитора на трёх якорях');
  if (assertCompatible(config2, graph).valid) {
    console.log(JSON.stringify(solve(config2, graph, manifest), null, 2));
  }
}

module.exports = { solve };

if (require.main === module) {
  printDemo();
}
