import { randomUUID } from 'node:crypto';

// A prefix for the Pinecone indexes one integration suite creates, which its
// afterAll deletes by that prefix. Pinecone Local is shared by every suite of
// a run and by concurrent runs, so the time alone is not enough: two suites
// starting in the same millisecond would delete each other's indexes.
export const integrationRunId = () => `it-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
