const fs = require('fs');
const path = require('path');
const { loadGraph } = require('../catalog/graph');
const { calculateBOM } = require('../core/bom');
const { createProfile, updateProfile } = require('../profile/customerProfile');

function loadManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'manifest', 'workspace.json'), 'utf8')
  );
}

describe('calculateBOM', () => {
  const graph = loadGraph();
  const manifest = loadManifest();

  it('builds a line for each selected element', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor',
      'keyboard',
      'mouse',
    ];
    const bom = calculateBOM(items, graph, manifest);

    expect(bom.lines).toHaveLength(6);
    for (const line of bom.lines) {
      expect(line).toEqual(
        expect.objectContaining({
          elementId: expect.any(String),
          sku: expect.any(String),
          name: expect.any(String),
          priceEur: expect.any(Number),
          quantity: expect.any(Number),
          totalEur: expect.any(Number),
        })
      );
      expect(line.totalEur).toBe(line.priceEur * line.quantity);
    }
  });

  it('groups duplicate elements into one line', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor_arm',
      'monitor',
      'monitor',
    ];
    const bom = calculateBOM(items, graph, manifest);
    const armLine = bom.lines.find((line) => line.elementId === 'monitor_arm');
    const monitorLine = bom.lines.find((line) => line.elementId === 'monitor');

    expect(armLine.quantity).toBe(2);
    expect(monitorLine.quantity).toBe(2);
    expect(armLine.totalEur).toBe(85 * 2);
  });

  it('includes VAT in the total (HomeCraft defect guard)', () => {
    const items = ['desk_frame', 'desk_top', 'keyboard'];
    const bom = calculateBOM(items, graph, manifest);

    expect(bom.vatEur).toBe(bom.subtotalEur * 0.2);
    expect(bom.totalEur).toBe(bom.subtotalEur + bom.vatEur);
    expect(bom.totalEur).not.toBe(bom.subtotalEur);
  });

  it('warns when the budget is exceeded but still returns a BOM', () => {
    const items = [
      'desk_frame',
      'desk_top',
      'monitor_arm',
      'monitor',
      'keyboard',
      'mouse',
    ];
    const profile = updateProfile(createProfile(), { budgetEur: 100 });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const bom = calculateBOM(items, graph, manifest, profile);

    expect(bom.totalEur).toBeGreaterThan(100);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Budget exceeded'));
    warn.mockRestore();
  });

  it('throws when an element is missing from the graph', () => {
    expect(() =>
      calculateBOM(['desk_top', 'несуществующий-id'], graph, manifest)
    ).toThrow('not found in graph');
  });

  it('throws when vatRate is missing from the manifest', () => {
    const noVat = { ...manifest };
    delete noVat.vatRate;

    expect(() => calculateBOM(['desk_top'], graph, noVat)).toThrow(
      'vatRate not defined'
    );
  });
});
