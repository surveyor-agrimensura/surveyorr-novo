const DATABASE = 'surveyor-offline-drafts';
const STORE = 'drafts';
const VERSION = 1;
const MIGRATION_KEY = 'surveyor-offline-drafts-migrated-v1';

type StoredDraft = { key: string; schemaVersion: number; savedAt: number; payload: unknown };
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível.')); return; }
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error || new Error('Não foi possível abrir os rascunhos locais.')); };
    request.onblocked = () => { databasePromise = null; reject(new Error('Feche outra aba do Surveyor para atualizar o armazenamento de rascunhos.')); };
  });
  return databasePromise;
}

function requestValue<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDatabase().then(database => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    let result: T = undefined as T;
    request.onsuccess = () => { result = request.result as T; };
    request.onerror = () => reject(request.error || new Error('Falha ao acessar um rascunho local.'));
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error || new Error('A gravação do rascunho foi interrompida.'));
    transaction.onerror = () => reject(transaction.error || new Error('Falha ao acessar o armazenamento de rascunhos.'));
  }));
}

export async function writeOfflineDraft(key: string, payload: unknown): Promise<boolean> {
  if (!key || typeof window === 'undefined') return false;
  try {
    await requestValue<IDBValidKey>('readwrite', store => store.put({ key, schemaVersion: VERSION, savedAt: Date.now(), payload } satisfies StoredDraft));
    return true;
  } catch { return false; }
}

export async function readOfflineDraft<T>(key: string): Promise<T | null> {
  if (!key || typeof window === 'undefined') return null;
  try {
    const stored = await requestValue<StoredDraft | undefined>('readonly', store => store.get(key));
    if (stored && stored.schemaVersion === VERSION) return stored.payload as T;
  } catch { /* tenta recuperar o rascunho legado abaixo */ }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as T;
    void writeOfflineDraft(key, value);
    return value;
  } catch { return null; }
}

export async function removeOfflineDraft(key: string): Promise<void> {
  if (!key || typeof window === 'undefined') return;
  try { await requestValue<IDBValidKey>('readwrite', store => store.delete(key)); } catch { /* a cópia local antiga continua disponível */ }
}

function isDraftKey(key: string) {
  return /^surveyor-(?:map-draft|project-meta|map-cloud-sync|map-versions|croqui-draft|memorial-draft|technical-sheet|sheet-draft|geracao)(?:-|:|$)/i.test(key)
    || /^surveyor:sheet:v1:/i.test(key);
}

/** Copies existing project drafts into versioned IndexedDB without deleting the old recovery copies. */
export async function migrateLegacyOfflineDrafts(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try { if (window.localStorage.getItem(MIGRATION_KEY) === '1') return 0; } catch { return 0; }
  let migrated = 0;
  const drafts: Array<{ key: string; payload: unknown }> = [];
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (!key || !isDraftKey(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw || raw.length > 25_000_000) continue;
      try { drafts.push({ key, payload: JSON.parse(raw) as unknown }); } catch { drafts.push({ key, payload: raw }); }
    }
  } catch { return 0; }
  for (const draft of drafts) if (await writeOfflineDraft(draft.key, draft.payload)) migrated++;
  if (migrated === drafts.length) try { window.localStorage.setItem(MIGRATION_KEY, '1'); } catch { /* a migração ainda pode ser repetida na próxima sessão */ }
  return migrated;
}
