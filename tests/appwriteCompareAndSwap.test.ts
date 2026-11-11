import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Backend JavaScript module is intentionally checked by Node, not emitted as TypeScript declarations.
import { createAppwriteClient } from '../functions/surveyor-api/src/appwrite/client.js';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' }
});

function makeClient(fetcher: typeof fetch) {
  vi.stubGlobal('fetch', fetcher);
  return createAppwriteClient({
    env: (key: string, fallback = '') => ({
      APPWRITE_ENDPOINT: 'https://mock.appwrite.invalid/v1',
      APPWRITE_PROJECT_ID: 'test-project',
      APPWRITE_DATABASE_ID: 'surveyor_db',
      APPWRITE_API_KEY: 'fake-key-for-test-only'
    }[key] || fallback),
    statusError: (status: number, message: string, details: unknown = null) => Object.assign(new Error(message), { status, details }),
    appwriteId: () => 'generated-id',
    normalizeEmail: (value: string) => value.toLowerCase()
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('comparação condicional de projetos no Appwrite', () => {
  it('usa uma única atualização em lote com filtros de id e $updatedAt', async () => {
    const calls: Array<{ path: string; method: string; body?: Record<string, any> }> = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = String(init?.method || 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, any> : undefined;
      calls.push({ path: `${url.pathname}${url.search}`, method, body });
      if (url.pathname === '/v1/databases/surveyor_db/collections/projects/documents/p1' && method === 'GET') {
        return json({ $id: 'p1', $updatedAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T09:59:00.000Z' });
      }
      if (url.pathname === '/v1/databases/surveyor_db/collections/projects/documents' && method === 'PATCH') {
        return json({ total: 1, documents: [{ $id: 'p1', $updatedAt: body?.data?.$updatedAt, ...body?.data }] });
      }
      return json({ message: `unexpected ${method} ${url.pathname}` }, 404);
    }) as typeof fetch;

    const client = makeClient(fetcher);
    const detected = await client.getRowWithMode('projects', 'p1');
    const saved = await client.compareAndSwapRow('projects', 'p1', detected.row, { geojsonFileId: 'next-file' }, { mode: detected.mode });
    const write = calls.find((call) => call.method === 'PATCH');

    expect(saved).toMatchObject({ $id: 'p1', geojsonFileId: 'next-file' });
    expect(write?.path).toBe('/v1/databases/surveyor_db/collections/projects/documents');
    expect(write?.body?.queries).toEqual([
      JSON.stringify({ method: 'equal', attribute: '$id', values: ['p1'] }),
      JSON.stringify({ method: 'equal', attribute: '$updatedAt', values: ['2026-11-04T10:00:00.000Z'] })
    ]);
    expect(Date.parse(write?.body?.data?.$updatedAt)).toBeGreaterThan(Date.parse('2026-11-04T10:00:00.000Z'));
  });

  it('usa TablesDB quando a linha pertence a essa família de rotas', async () => {
    const calls: Array<{ path: string; method: string }> = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = String(init?.method || 'GET').toUpperCase();
      calls.push({ path: `${url.pathname}${url.search}`, method });
      if (url.pathname === '/v1/databases/surveyor_db/collections/projects/documents/p1') return json({ message: 'unsupported' }, 404);
      if (url.pathname === '/v1/tablesdb/surveyor_db/tables/projects/rows/p1') return json({ $id: 'p1', $updatedAt: '2026-11-04T10:00:00.000Z' });
      if (url.pathname === '/v1/tablesdb/surveyor_db/tables/projects/rows' && method === 'PATCH') {
        return json({ total: 1, rows: [{ $id: 'p1', $updatedAt: '2026-11-04T10:00:00.001Z', geojsonFileId: 'next-file' }] });
      }
      return json({ message: `unexpected ${method} ${url.pathname}` }, 404);
    }) as typeof fetch;

    const client = makeClient(fetcher);
    const detected = await client.getRowWithMode('projects', 'p1');
    const saved = await client.compareAndSwapRow('projects', 'p1', detected.row, { geojsonFileId: 'next-file' }, { mode: detected.mode });

    expect(detected.mode).toBe('tables');
    expect(saved).toMatchObject({ geojsonFileId: 'next-file' });
    expect(calls.some((call) => call.path === '/v1/tablesdb/surveyor_db/tables/projects/rows' && call.method === 'PATCH')).toBe(true);
  });

  it('converte resultado sem linhas em conflito editável', async () => {
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/documents/p1')) return json({ $id: 'p1', $updatedAt: '2026-11-04T10:00:00.000Z' });
      if (url.pathname.endsWith('/collections/projects/documents') && init?.method === 'PATCH') return json({ total: 0, documents: [] });
      return json({ message: 'unexpected' }, 404);
    }) as typeof fetch;
    const client = makeClient(fetcher);
    const detected = await client.getRowWithMode('projects', 'p1');

    await expect(client.compareAndSwapRow('projects', 'p1', detected.row, { geojsonFileId: 'stale-file' }, { mode: detected.mode }))
      .rejects.toMatchObject({ status: 409, details: { code: 'EDIT_CONFLICT' } });
  });
});

describe('limite concorrente de acesso de compartilhamento público', () => {
  it('mantém funcionando o link curto documental sem compartilhamento avançado', async () => {
    const source = readFileSync(new URL('../functions/surveyor-api/src/main.js', import.meta.url), 'utf8');
    const start = source.indexOf('async function sendPublicProjectShare(');
    const end = source.indexOf('\nfunction normalizeEmail(', start);
    const row = { $id: 'p-short', $updatedAt: '2026-11-04T10:00:00.000Z', userId: 'owner-1', status: 'active', geojsonFileId: 'short-file' };
    const payload = { metadata: { publicShortEnabled: true }, features: [] };
    const deps = {
      getRowWithMode: async () => ({ row: { ...row }, mode: 'documents' }),
      getRow: async () => ({ ...row }),
      readProjectPayload: async () => structuredClone(payload),
      projectPayloadShares: (value: any) => ({ metadata: value.metadata || {}, shares: Array.isArray(value.metadata?.secureShares) ? value.metadata.secureShares : [] }),
      assertShareUsable: async () => {},
      stageProjectPayload: async () => ({ fileId: 'short-file-next', previousFileId: 'short-file', bucket: 'project_files' }),
      compareAndSwapRow: async (_name: string, _id: string, observed: any, data: any) => ({ ...observed, ...data, $updatedAt: '2026-11-04T10:00:00.001Z' }),
      deleteFile: async () => {},
      statusError: (status: number, message: string, details: unknown = null) => Object.assign(new Error(message), { status, details }),
      mapProject: (value: any) => ({ id: value.$id }),
      mapFeature: (feature: unknown) => feature,
      listRows: async () => [],
      Query: { equal: () => '', limit: () => '' },
      serializeDocumentCustomization: async (value: unknown) => value,
      publicCustomizationView: (value: unknown) => value,
      publicShareView: (value: unknown) => value,
      send: (_response: unknown, _request: unknown, status: number, body: unknown) => ({ status, body })
    };
    const sendShare = new Function(...Object.keys(deps), `${source.slice(start, end)}\nreturn sendPublicProjectShare;`)(...Object.values(deps)) as (...args: any[]) => Promise<any>;

    const result = await sendShare({}, {}, row, payload, { id: 'public-short:p-short' });
    expect(result.status).toBe(200);
    expect(result.body.share.id).toBe('public-short:p-short');
  });

  it('não ultrapassa o limite quando dois acessos concorrentes tentam gravar juntos', async () => {
    const source = readFileSync(new URL('../functions/surveyor-api/src/main.js', import.meta.url), 'utf8');
    const start = source.indexOf('async function sendPublicProjectShare(');
    const end = source.indexOf('\nfunction normalizeEmail(', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const files = new Map<string, Record<string, any>>();
    let releaseFirstPair!: () => void;
    const firstPairBarrier = new Promise<void>((resolve) => { releaseFirstPair = resolve; });
    let readArrivals = 0;
    let currentRow: Record<string, any> = { $id: 'p1', $updatedAt: '2026-11-04T10:00:00.000Z', userId: 'owner-1', status: 'active', geojsonFileId: 'f0' };
    let fileSequence = 0;
    files.set('f0', { metadata: { secureShares: [{ id: 'share-1', accessCount: 0, maxAccessCount: 1 }] }, features: [] });

    const deps = {
      getRowWithMode: async () => ({ row: { ...currentRow }, mode: 'documents' }),
      getRow: async () => ({ ...currentRow }),
      readProjectPayload: async (row: Record<string, any>) => {
        readArrivals += 1;
        if (readArrivals === 2) releaseFirstPair();
        await firstPairBarrier;
        return structuredClone(files.get(row.geojsonFileId));
      },
      projectPayloadShares: (payload: Record<string, any> = {}) => {
        const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
        return { metadata, shares: Array.isArray(metadata.secureShares) ? metadata.secureShares : [] };
      },
      assertShareUsable: async (share: Record<string, any>) => {
        if (Number(share.accessCount || 0) >= Number(share.maxAccessCount || 0)) {
          throw Object.assign(new Error('Limite atingido'), { status: 401 });
        }
      },
      stageProjectPayload: async (row: Record<string, any>, payload: Record<string, any>) => {
        const fileId = `f${++fileSequence}`;
        files.set(fileId, structuredClone(payload));
        return { fileId, previousFileId: row.geojsonFileId, bucket: 'project_files' };
      },
      compareAndSwapRow: async (_name: string, _id: string, observed: Record<string, any>, data: Record<string, any>) => {
        if (observed.$updatedAt !== currentRow.$updatedAt) {
          throw Object.assign(new Error('CAS conflict'), { status: 409, details: { code: 'EDIT_CONFLICT' } });
        }
        const nextRevision = new Date(Date.parse(currentRow.$updatedAt) + 1).toISOString();
        currentRow = { ...currentRow, ...data, $updatedAt: nextRevision };
        return { ...currentRow };
      },
      deleteFile: async (_bucket: string, fileId: string) => { files.delete(fileId); },
      statusError: (status: number, message: string, details: unknown = null) => Object.assign(new Error(message), { status, details }),
      mapProject: (row: Record<string, any>) => ({ id: row.$id, userId: row.userId }),
      mapFeature: (feature: unknown) => feature,
      listRows: async () => [],
      Query: { equal: () => '', limit: () => '' },
      serializeDocumentCustomization: async (row: unknown) => row,
      publicCustomizationView: (value: unknown) => value,
      publicShareView: (share: unknown) => share,
      send: (_response: unknown, _request: unknown, status: number, payload: unknown) => ({ status, payload })
    };
    const create = new Function(...Object.keys(deps), `${source.slice(start, end)}\nreturn sendPublicProjectShare;`);
    const sendShare = create(...Object.values(deps)) as (...args: any[]) => Promise<any>;
    const row = { ...currentRow };
    const request = {};
    const share = { id: 'share-1' };
    const results = await Promise.allSettled([
      sendShare({}, request, row, {}, share),
      sendShare({}, request, row, {}, share)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(files.get(currentRow.geojsonFileId)?.metadata.secureShares[0].accessCount).toBe(1);
  });
});
