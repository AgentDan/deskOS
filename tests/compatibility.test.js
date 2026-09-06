const { loadGraph } = require('../catalog/graph');
const { assertCompatible } = require('../core/compatibility');

describe('assertCompatible', () => {
  const graph = loadGraph();

  it('accepts a desk with a monitor', () => {
    const result = assertCompatible(['desk_top', 'monitor'], graph);

    expect(result.valid).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('rejects a monitor without a desk', () => {
    const result = assertCompatible(['monitor'], graph);

    expect(result.valid).toBe(false);
    expect(result.conflicts.some((conflict) => conflict.element === 'monitor')).toBe(
      true
    );
    expect(result.suggestedSkus).toContain('desk_top');
  });

  it('accepts a desk without a monitor', () => {
    const result = assertCompatible(['desk_top'], graph);

    expect(result.valid).toBe(true);
    expect(result.conflicts).toEqual([]);
  });
});
