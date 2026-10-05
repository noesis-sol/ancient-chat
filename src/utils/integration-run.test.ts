import { describe, expect, it, vi } from 'vitest';
import { integrationRunId } from './integration-run';
import { checkIndexName, MAX_INDEX_NAME_LENGTH } from './upload-rules';

describe('integrationRunId', () => {
  it('differs between suites that start in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_780_000_000_000);
    try {
      const ids = new Set(Array.from({ length: 100 }, integrationRunId));
      expect(ids.size).toBe(100);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('leaves room for a suffix within a valid index name', () => {
    const indexName = `${integrationRunId()}-republic`;
    expect(checkIndexName(indexName)).toEqual({ indexName });
    expect(indexName.length).toBeLessThan(MAX_INDEX_NAME_LENGTH);
  });
});
