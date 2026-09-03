const { loadGraph } = require('../catalog/graph');

describe('loadGraph', () => {
  it('loads the manifest without errors', () => {
    expect(() => loadGraph()).not.toThrow();
  });

  it('returns exactly 10 elements', () => {
    const graph = loadGraph();
    expect(graph).toHaveLength(10);
  });

  it('gives each element id, sku, priceEur and dimensions', () => {
    const graph = loadGraph();

    for (const node of graph) {
      expect(typeof node.id).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
      expect(typeof node.sku).toBe('string');
      expect(node.sku.length).toBeGreaterThan(0);
      expect(typeof node.priceEur).toBe('number');
      expect(node.dimensions).toEqual(
        expect.objectContaining({
          width: expect.any(Number),
          depth: expect.any(Number),
          height: expect.any(Number),
        })
      );
    }
  });
});
