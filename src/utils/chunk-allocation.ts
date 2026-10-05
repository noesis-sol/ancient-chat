/**
 * Splits `totalChunks` between indexes in proportion to their weights, using
 * largest-remainder rounding so the shares always sum to `totalChunks`.
 *
 * Negative or non-finite weights count as 0. If every weight is 0, the chunks
 * are split evenly. An index can get 0 chunks (weight 0, a tiny share, or more
 * indexes than chunks); callers must skip those, since Pinecone rejects topK 0.
 * Ties go to the earlier index, so the result is deterministic.
 */
export function allocateChunks(weights: number[], totalChunks: number): number[] {
  if (weights.length === 0 || totalChunks <= 0) {
    return weights.map(() => 0);
  }

  const cleaned = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const totalWeight = cleaned.reduce((acc, weight) => acc + weight, 0);
  const shares = totalWeight > 0 ? cleaned : cleaned.map(() => 1);
  const shareTotal = totalWeight > 0 ? totalWeight : shares.length;

  const quotas = shares.map((share) => (totalChunks * share) / shareTotal);
  const allocation = quotas.map(Math.floor);

  let remaining = totalChunks - allocation.reduce((acc, chunks) => acc + chunks, 0);
  const byRemainder = quotas
    .map((quota, i) => ({ i, remainder: quota - allocation[i] }))
    .filter(({ i }) => shares[i] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  for (const { i } of byRemainder) {
    if (remaining <= 0) {
      break;
    }
    allocation[i]++;
    remaining--;
  }

  return allocation;
}
