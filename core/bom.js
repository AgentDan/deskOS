const fs = require('fs');
const path = require('path');
const { loadGraph } = require('../catalog/graph');
const { assertCompatible } = require('./compatibility');
const { solve } = require('./solver');

function calculateBOM(items, graph, manifest, profile) {
  if (manifest.vatRate == null) {
    throw new Error('vatRate not defined in manifest');
  }

  const byId = new Map(graph.map((node) => [node.id, node]));
  const order = [];
  const quantities = new Map();

  for (const elementId of items) {
    if (!byId.has(elementId)) {
      throw new Error('Element ' + elementId + ' not found in graph');
    }
    if (!quantities.has(elementId)) {
      order.push(elementId);
      quantities.set(elementId, 0);
    }
    quantities.set(elementId, quantities.get(elementId) + 1);
  }

  const lines = order.map((elementId) => {
    const node = byId.get(elementId);
    const quantity = quantities.get(elementId);
    return {
      elementId,
      sku: node.sku,
      name: node.name,
      priceEur: node.priceEur,
      quantity,
      totalEur: node.priceEur * quantity,
    };
  });

  const vatRate = manifest.vatRate;
  const subtotalEur = lines.reduce((sum, line) => sum + line.totalEur, 0);
  const vatEur = subtotalEur * vatRate;
  const totalEur = subtotalEur + vatEur;

  console.log('BOM calculated:');
  console.log('  Lines: ' + lines.length);
  console.log('  Subtotal: ' + subtotalEur + ' EUR');
  console.log('  VAT (' + vatRate * 100 + '%): ' + vatEur + ' EUR');
  console.log('  Total: ' + totalEur + ' EUR');

  const budgetEur = profile && profile.workspace ? profile.workspace.budgetEur : null;
  if (budgetEur != null && totalEur > budgetEur) {
    console.warn('Budget exceeded: ' + totalEur + ' > ' + budgetEur + ' EUR');
  }

  return {
    lines,
    subtotalEur,
    vatEur,
    totalEur,
  };
}

function loadManifest() {
  const manifestPath = path.join(__dirname, '..', 'manifest', 'workspace.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function printDemo() {
  const items = [
    'desk_frame',
    'desk_top',
    'monitor_arm',
    'monitor',
    'keyboard',
    'mouse',
  ];
  const graph = loadGraph();
  const manifest = loadManifest();

  console.log('Конфигурация: стол + рама + кронштейн + монитор + клавиатура + мышь');

  const compatibility = assertCompatible(items, graph);
  const scene = solve(items, graph, manifest);

  if (!compatibility.valid || scene.status !== 'solved') {
    console.log('Configuration is not ready for BOM');
    return;
  }

  const bom = calculateBOM(items, graph, manifest);
  for (const line of bom.lines) {
    console.log(
      line.name +
        ' x' +
        line.quantity +
        ': ' +
        line.priceEur +
        ' EUR (line ' +
        line.totalEur +
        ' EUR)'
    );
  }
  console.log('subtotal: ' + bom.subtotalEur + ' EUR');
  console.log('VAT 20%: ' + bom.vatEur + ' EUR');
  console.log('total: ' + bom.totalEur + ' EUR');
}

module.exports = { calculateBOM };

if (require.main === module) {
  printDemo();
}
