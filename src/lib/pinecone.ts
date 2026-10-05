import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/lib/env';

// One client per process, created on first use: reading env() at module scope
// throws during `next build` when PINECONE_API_KEY is unset.
let pinecone: Pinecone | undefined;

export function getPinecone(): Pinecone {
  if (!pinecone) {
    const { PINECONE_API_KEY: apiKey, PINECONE_CONTROLLER_HOST: controllerHostUrl } = env();
    pinecone = new Pinecone(controllerHostUrl ? { apiKey, controllerHostUrl } : { apiKey });
  }
  return pinecone;
}

// Data-plane hosts of Pinecone Local indexes, by index name. Pinecone Local
// reports hosts without a scheme (localhost:5081), and the SDK would reach
// them over HTTPS, so they get the controller URL's scheme instead.
const localHosts = new Map<string, string>();

async function localIndexHost(name: string, controllerHost: string): Promise<string> {
  let host = localHosts.get(name);
  if (!host) {
    const described = (await getPinecone().describeIndex(name)).host;
    host = /^https?:\/\//.test(described) ? described : `${new URL(controllerHost).protocol}//${described}`;
    localHosts.set(name, host);
  }
  return host;
}

export async function getIndex(name: string) {
  const controllerHost = env().PINECONE_CONTROLLER_HOST;
  if (!controllerHost) {
    return getPinecone().index({ name });
  }
  return getPinecone().index({ name, host: await localIndexHost(name, controllerHost) });
}

export async function deleteIndex(name: string) {
  await getPinecone().deleteIndex(name);
  // A recreated index can get a different host.
  localHosts.delete(name);
}
