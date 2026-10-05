import { describe, expect, it } from 'vitest';
import { planIndexSync } from './index-sync';

const row = { id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 2 };

describe('planIndexSync embedding model', () => {
  it('records the model a new index is tagged with', () => {
    const plan = planIndexSync([], [
      { name: 'plato', host: 'h1.pinecone.io', tags: { embedding_model: 'text-embedding-3-small' } }
    ]);

    expect(plan.creates).toEqual([
      { id: 'h1.pinecone.io', name: 'plato', is_active: false, weight: 1, embedding_model: 'text-embedding-3-small' }
    ]);
  });

  it('takes an untagged index to be embedded with text-embedding-ada-002', () => {
    const plan = planIndexSync([], [{ name: 'plato', host: 'h1.pinecone.io', tags: { other: 'x' } }]);

    expect(plan.creates[0].embedding_model).toBe('text-embedding-ada-002');
  });

  it('updates the model when the tag changes, keeping the settings', () => {
    const plan = planIndexSync([{ ...row, embedding_model: 'text-embedding-ada-002' }], [
      { name: 'plato', host: 'h1.pinecone.io', tags: { embedding_model: 'text-embedding-3-large' } }
    ]);

    expect(plan).toEqual({
      deletes: [],
      updates: [
        { id: 'h1.pinecone.io', data: { id: 'h1.pinecone.io', name: 'plato', embedding_model: 'text-embedding-3-large' } }
      ],
      creates: []
    });
  });

  it('leaves a row alone whose model matches the tag', () => {
    const plan = planIndexSync([{ ...row, embedding_model: 'text-embedding-3-small' }], [
      { name: 'plato', host: 'h1.pinecone.io', tags: { embedding_model: 'text-embedding-3-small' } }
    ]);

    expect(plan).toEqual({ deletes: [], updates: [], creates: [] });
  });
});
