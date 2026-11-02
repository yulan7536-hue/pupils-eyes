/**
 * 3D 摆件的本地存储。
 *
 * glb 动辄几 MB 到几十 MB，localStorage（5–10MB 配额）完全放不下，
 * 所以模型二进制存 IndexedDB，元信息（id / 体积 / 缩略图）也一并存在这里。
 */

const DB_NAME = 'pupils-eyes-models';
const DB_VERSION = 1;
const STORE = 'models';

export interface Model3DItem {
  id: string;
  /** glb 二进制 */
  glb: Blob;
  /** 字节数，用于界面提示 */
  bytes: number;
  createdAt: number;
  /** 缩略图 dataURL（用原照片，轻量） */
  thumb?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'));
        t.oncomplete = () => db.close();
      })
  );
}

export async function saveModel(glb: Blob, thumb?: string): Promise<Model3DItem> {
  const item: Model3DItem = {
    id: `m3d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    glb,
    bytes: glb.size,
    createdAt: Date.now(),
    thumb,
  };
  await tx('readwrite', (s) => s.put(item) as IDBRequest<IDBValidKey>);
  return item;
}

export async function listModels(): Promise<Model3DItem[]> {
  try {
    const all = await tx<Model3DItem[]>('readonly', (s) => s.getAll() as IDBRequest<Model3DItem[]>);
    return (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function getModel(id: string): Promise<Model3DItem | null> {
  try {
    const item = await tx<Model3DItem | undefined>('readonly', (s) => s.get(id) as IDBRequest<Model3DItem | undefined>);
    return item ?? null;
  } catch {
    return null;
  }
}

export async function removeModel(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

/** 估算所有模型占用的空间（字节） */
export async function totalModelBytes(): Promise<number> {
  const all = await listModels();
  return all.reduce((sum, m) => sum + (m.bytes || 0), 0);
}
