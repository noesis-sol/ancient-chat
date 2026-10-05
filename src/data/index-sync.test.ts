import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { NEW_INDEX_DEFAULTS, planIndexSync } from './index-sync.ts';
import type { IndexRow, IndexSyncPlan, PineconeIndexRef } from './index-sync.ts';

// Applies a plan in the order the service runs it, enforcing the Index table's
// unique id and name like Postgres would.
function apply(rows: IndexRow[], plan: IndexSyncPlan): IndexRow[] {
  let table = rows.map((row) => ({ ...row }));
  const assertUnique = () => {
    assert.equal(new Set(table.map((row) => row.id)).size, table.length, 'duplicate id');
    assert.equal(new Set(table.map((row) => row.name)).size, table.length, 'duplicate name');
  };

  for (const id of plan.deletes) {
    assert.ok(table.some((row) => row.id === id), `delete of missing row ${id}`);
    table = table.filter((row) => row.id !== id);
  }
  for (const { id, data } of plan.updates) {
    const row = table.find((row) => row.id === id);
    assert.ok(row, `update of missing row ${id}`);
    Object.assign(row, data);
    assertUnique();
  }
  for (const row of plan.creates) {
    table.push({ ...row });
    assertUnique();
  }
  return table;
}

function sync(rows: IndexRow[], pinecone: PineconeIndexRef[]) {
  return apply(rows, planIndexSync(rows, pinecone));
}

const byName = (rows: IndexRow[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name));

describe('planIndexSync', () => {
  it('creates new indexes with explicit defaults', () => {
    const plan = planIndexSync([], [{ name: 'plato', host: 'plato-1.pinecone.io' }]);

    assert.deepEqual(plan, {
      deletes: [],
      updates: [],
      creates: [{ id: 'plato-1.pinecone.io', name: 'plato', is_active: false, weight: 1 }]
    });
    assert.deepEqual(NEW_INDEX_DEFAULTS, { is_active: false, weight: 1 });
  });

  it('does nothing when the DB already matches Pinecone', () => {
    const rows = [{ id: 'plato-1.pinecone.io', name: 'plato', is_active: true, weight: 3 }];

    assert.deepEqual(planIndexSync(rows, [{ name: 'plato', host: 'plato-1.pinecone.io' }]), {
      deletes: [],
      updates: [],
      creates: []
    });
  });

  it('keeps is_active and weight when an index is recreated with the same name', () => {
    const rows = [
      { id: 'plato-old.pinecone.io', name: 'plato', is_active: true, weight: 2.5 },
      { id: 'homer-1.pinecone.io', name: 'homer', is_active: false, weight: 1 }
    ];
    const pinecone = [
      { name: 'plato', host: 'plato-new.pinecone.io' },
      { name: 'homer', host: 'homer-1.pinecone.io' }
    ];

    const plan = planIndexSync(rows, pinecone);
    assert.deepEqual(plan, {
      deletes: [],
      updates: [{ id: 'plato-old.pinecone.io', data: { id: 'plato-new.pinecone.io', name: 'plato' } }],
      creates: []
    });
    assert.deepEqual(byName(apply(rows, plan)), [
      { id: 'homer-1.pinecone.io', name: 'homer', is_active: false, weight: 1 },
      { id: 'plato-new.pinecone.io', name: 'plato', is_active: true, weight: 2.5 }
    ]);
  });

  it('keeps settings when a host is listed under a new name', () => {
    const rows = [{ id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 4 }];

    assert.deepEqual(sync(rows, [{ name: 'aristotle', host: 'h1.pinecone.io' }]), [
      { id: 'h1.pinecone.io', name: 'aristotle', is_active: true, weight: 4 }
    ]);
  });

  it('frees a name before another host takes it', () => {
    // 'plato' moved to a new host and its old host now serves 'aristotle'.
    const rows = [{ id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 4 }];
    const pinecone = [
      { name: 'plato', host: 'h2.pinecone.io' },
      { name: 'aristotle', host: 'h1.pinecone.io' }
    ];

    assert.deepEqual(byName(sync(rows, pinecone)), [
      { id: 'h1.pinecone.io', name: 'aristotle', is_active: false, weight: 1 },
      { id: 'h2.pinecone.io', name: 'plato', is_active: true, weight: 4 }
    ]);
  });

  it('deletes rows for indexes removed from Pinecone', () => {
    const rows = [
      { id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 1 },
      { id: 'h2.pinecone.io', name: 'homer', is_active: true, weight: 1 }
    ];
    // 'homer' is gone and 'sappho' is new.
    const pinecone = [
      { name: 'plato', host: 'h1.pinecone.io' },
      { name: 'sappho', host: 'h3.pinecone.io' }
    ];

    const plan = planIndexSync(rows, pinecone);
    assert.deepEqual(plan.deletes, ['h2.pinecone.io']);
    assert.deepEqual(byName(apply(rows, plan)), [
      { id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 1 },
      { id: 'h3.pinecone.io', name: 'sappho', is_active: false, weight: 1 }
    ]);
  });

  it('deletes every row when Pinecone has no indexes', () => {
    const rows = [{ id: 'h1.pinecone.io', name: 'plato', is_active: true, weight: 1 }];

    assert.deepEqual(sync(rows, []), []);
  });
});
