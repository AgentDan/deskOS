const { loadGraph } = require('../catalog/graph');
const { assertCompatible } = require('../core/compatibility');

describe('assertCompatible', () => {
  const graph = loadGraph();

  it('accepts a valid configuration', () => {
    const result = assertCompatible(
      ['desk_frame', 'desk_top', 'monitor_arm', 'monitor', 'keyboard', 'mouse'],
      graph
    );

    expect(result.valid).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('rejects a monitor without an arm', () => {
    const result = assertCompatible(
      ['desk_frame', 'desk_top', 'monitor'],
      graph
    );

    expect(result.valid).toBe(false);
    expect(result.conflicts.some((conflict) => conflict.element === 'monitor')).toBe(
      true
    );
    expect(result.suggestedSkus).toContain('monitor_arm');
  });

  it('rejects an arm without a desk top', () => {
    const result = assertCompatible(
      ['desk_frame', 'monitor_arm', 'monitor'],
      graph
    );

    expect(result.valid).toBe(false);
    expect(
      result.conflicts.some((conflict) => conflict.element === 'monitor_arm')
    ).toBe(true);
  });

  it('suggests required desk dependencies for a lone monitor', () => {
    const result = assertCompatible(['monitor'], graph);

    expect(result.valid).toBe(false);
    expect(result.suggestedSkus).toEqual(
      expect.arrayContaining(['desk_top', 'desk_frame'])
    );
  });
});
