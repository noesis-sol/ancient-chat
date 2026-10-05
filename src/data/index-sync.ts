export interface IndexRow {
  id: string;
  name: string;
  is_active: boolean;
  weight: number;
}

export interface PineconeIndexRef {
  name: string;
  host: string;
}

export interface IndexSyncPlan {
  // Ids of rows whose index is gone from Pinecone.
  deletes: string[];
  // Rows whose host (id) or name changed; is_active and weight are kept.
  updates: { id: string; data: { id: string; name: string } }[];
  creates: IndexRow[];
}

// A newly seen index starts inactive, so the admin decides when chat uses it.
export const NEW_INDEX_DEFAULTS = { is_active: false, weight: 1 } as const;

/**
 * Plans how to bring the Index rows in line with the Pinecone index list.
 *
 * Rows are matched by name (unique in the DB), so an index recreated with the
 * same name keeps its settings and only its host changes. A row not matched by
 * name but whose host is still in Pinecone is treated as renamed.
 *
 * Apply deletes, then updates, then creates: a recreated or renamed index
 * reuses the name or host of a row that may still be in the way.
 */
export function planIndexSync(existing: IndexRow[], pinecone: PineconeIndexRef[]): IndexSyncPlan {
  const rowsByName = new Map(existing.map((row) => [row.name, row]));
  const matched = new Map<PineconeIndexRef, IndexRow>();
  const unmatchedRows = new Set(existing);

  for (const index of pinecone) {
    const row = rowsByName.get(index.name);
    if (row) {
      matched.set(index, row);
      unmatchedRows.delete(row);
    }
  }

  const unmatchedRowsById = new Map([...unmatchedRows].map((row) => [row.id, row]));
  for (const index of pinecone) {
    if (matched.has(index)) continue;
    const row = unmatchedRowsById.get(index.host);
    if (row) {
      matched.set(index, row);
      unmatchedRows.delete(row);
    }
  }

  const plan: IndexSyncPlan = { deletes: [], updates: [], creates: [] };

  for (const row of unmatchedRows) {
    plan.deletes.push(row.id);
  }

  for (const index of pinecone) {
    const row = matched.get(index);
    if (!row) {
      plan.creates.push({ id: index.host, name: index.name, ...NEW_INDEX_DEFAULTS });
    } else if (row.id !== index.host || row.name !== index.name) {
      plan.updates.push({ id: row.id, data: { id: index.host, name: index.name } });
    }
  }

  return plan;
}
