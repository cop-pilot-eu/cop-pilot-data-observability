import { getBrokerTitle } from './brokers.const';

describe('getBrokerTitle', () => {
  it('keeps only the part after the cluster prefix for cluster 3 brokers', () => {
    expect(getBrokerTitle('cluster3a-aua', '3A')).toBe('aua');
    expect(getBrokerTitle('cluster3e-uc3', '3E')).toBe('uc3');
  });

  it('keeps the full id for other clusters', () => {
    expect(getBrokerTitle('cluster2', '2')).toBe('cluster2');
    expect(getBrokerTitle('cluster4', '4')).toBe('cluster4');
  });

  it('falls back to the full id when there is no "-"', () => {
    expect(getBrokerTitle('cluster3x', '3A')).toBe('cluster3x');
  });
});
