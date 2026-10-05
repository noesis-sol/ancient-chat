import { describe, expect, it } from 'vitest';
import { allocateChunks } from './chunk-allocation';

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

describe('allocateChunks', () => {
  it('splits proportionally when the shares divide evenly', () => {
    expect(allocateChunks([1, 1], 10)).toEqual([5, 5]);
    expect(allocateChunks([3, 2], 10)).toEqual([6, 4]);
    expect(allocateChunks([7], 10)).toEqual([10]);
  });

  it('uses largest-remainder rounding so the total is exact', () => {
    // Quotas 3.33.. each: Math.round would give 9 in total.
    expect(allocateChunks([1, 1, 1], 10)).toEqual([4, 3, 3]);
    // Quotas 1.5 each: Math.round would give 16 in total.
    expect(allocateChunks([1, 1, 1, 1, 1, 1, 1, 1], 12)).toEqual([2, 2, 2, 2, 1, 1, 1, 1]);
    // Quotas 4.5, 3.5, 2: equal remainders go to the earlier index.
    expect(allocateChunks([0.45, 0.35, 0.2], 10)).toEqual([5, 3, 2]);
  });

  it('gives 0 to an index with weight 0', () => {
    expect(allocateChunks([1, 0, 1], 10)).toEqual([5, 0, 5]);
    expect(allocateChunks([0, 2], 10)).toEqual([0, 10]);
  });

  it('gives 0 to an index whose share is too small', () => {
    expect(allocateChunks([1, 0.04], 10)).toEqual([10, 0]);
  });

  it('splits evenly when every weight is 0', () => {
    expect(allocateChunks([0, 0], 10)).toEqual([5, 5]);
    expect(allocateChunks([0, 0, 0], 10)).toEqual([4, 3, 3]);
  });

  it('gives at most one chunk each when there are more indexes than chunks', () => {
    const allocation = allocateChunks(new Array(11).fill(1), 10);
    expect(sum(allocation)).toBe(10);
    expect(allocation).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);

    const many = allocateChunks(new Array(25).fill(3), 10);
    expect(sum(many)).toBe(10);
    expect(many.every((chunks) => chunks === 0 || chunks === 1)).toBe(true);
  });

  it('treats negative and non-finite weights as 0', () => {
    expect(allocateChunks([-1, 1], 10)).toEqual([0, 10]);
    expect(allocateChunks([NaN, 1, Infinity], 10)).toEqual([0, 10, 0]);
    expect(allocateChunks([-1, -1], 10)).toEqual([5, 5]);
  });

  it('returns nothing for no indexes or no chunks', () => {
    expect(allocateChunks([], 10)).toEqual([]);
    expect(allocateChunks([1, 2], 0)).toEqual([0, 0]);
  });

  it('always sums to the total and never goes negative', () => {
    const cases = [
      [0.1, 0.2, 0.3],
      [1, 0.04, 0.04, 0.04],
      [5, 5, 5, 5, 5, 5, 5],
      [100, 1, 1, 1],
      [0.333, 0.333, 0.334]
    ];
    for (const weights of cases) {
      const allocation = allocateChunks(weights, 10);
      expect(sum(allocation), `weights ${weights}`).toBe(10);
      expect(allocation.every((chunks) => Number.isInteger(chunks) && chunks >= 0)).toBe(true);
    }
  });
});
