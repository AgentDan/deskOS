const fs = require('fs');
const path = require('path');

function loadGraph() {
  const manifestPath = path.join(__dirname, '..', 'manifest', 'workspace.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  return manifest.elements.map((element) => ({
    ...element,
    relations: element.relations ?? [],
  }));
}

function printCatalog(nodes) {
  for (const node of nodes) {
    console.log(`${node.name}: ${node.priceEur} EUR`);
  }
}

module.exports = { loadGraph };

if (require.main === module) {
  printCatalog(loadGraph());
}
