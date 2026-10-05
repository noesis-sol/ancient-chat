import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateChunks } from './chunk-allocation.ts';

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

describe('allocateChunks', () => {
  it('splits proportionally when the shares divide evenly', () => {
    assert.deepEqual(allocateChunks([1, 1], 10), [5, 5]);
    assert.deepEqual(allocateChunks([3, 2], 10), [6, 4]);
    assert.deepEqual(allocateChunks([7], 10), [10]);
  });

  it('uses largest-remainder rounding so the total is exact', () => {
    // Quotas 3.33.. each: Math.round would give 9 in total.
    assert.deepEqual(allocateChunks([1, 1, 1], 10), [4, 3, 3]);
    // Quotas 1.5 each: Math.round would give 16 in total.
    assert.deepEqual(allocateChunks([1, 1, 1, 1, 1, 1, 1, 1], 12), [2, 2, 2, 2, 1, 1, 1, 1]);
    // Quotas 4.5, 3.5, 2: equal remainders go to the earlier index.
    assert.deepEqual(allocateChunks([0.45, 0.35, 0.2], 10), [5, 3, 2]);
  });

  it('gives 0 to an index with weight 0', () => {
    assert.deepEqual(allocateChunks([1, 0, 1], 10), [5, 0, 5]);
    assert.deepEqual(allocateChunks([0, 2], 10), [0, 10]);
  });

  it('gives 0 to an index whose share is too small', () => {
    assert.deepEqual(allocateChunks([1, 0.04], 10), [10, 0]);
  });

  it('splits evenly when every weight is 0', () => {
    assert.deepEqual(allocateChunks([0, 0], 10), [5, 5]);
    assert.deepEqual(allocateChunks([0, 0, 0], 10), [4, 3, 3]);
  });

  it('gives at most one chunk each when there are more indexes than chunks', () => {
    const allocation = allocateChunks(new Array(11).fill(1), 10);
    assert.equal(sum(allocation), 10);
    assert.deepEqual(allocation, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);

    const many = allocateChunks(new Array(25).fill(3), 10);
    assert.equal(sum(many), 10);
    assert.ok(many.every((chunks) => chunks === 0 || chunks === 1));
  });

  it('treats negative and non-finite weights as 0', () => {
    assert.deepEqual(allocateChunks([-1, 1], 10), [0, 10]);
    assert.deepEqual(allocateChunks([NaN, 1, Infinity], 10), [0, 10, 0]);
    assert.deepEqual(allocateChunks([-1, -1], 10), [5, 5]);
  });

  it('returns nothing for no indexes or no chunks', () => {
    assert.deepEqual(allocateChunks([], 10), []);
    assert.deepEqual(allocateChunks([1, 2], 0), [0, 0]);
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
      assert.equal(sum(allocation), 10, `weights ${weights}`);
      assert.ok(allocation.every((chunks) => Number.isInteger(chunks) && chunks >= 0));
    }
  });
});
