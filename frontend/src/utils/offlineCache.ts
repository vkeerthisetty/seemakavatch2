import { openDB, IDBPDatabase } from 'idb';

const DB_NAME  = 'ibms_offline_v2';
const DB_VER   = 2;

const STORES = {
  QR_CACHE:    'qr_cache',
  SCAN_LOGS:   'offline_scan_logs',
  REFUGEES:    'offline_refugees',
  NGO_REQS:    'offline_ngo_requests',
  VERIF:       'offline_verif_results',
};

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VER, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORES.QR_CACHE)) {
          db.createObjectStore(STORES.QR_CACHE, { keyPath: 'border_id' });
        }
        if (!db.objectStoreNames.contains(STORES.SCAN_LOGS)) {
          db.createObjectStore(STORES.SCAN_LOGS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.REFUGEES)) {
          db.createObjectStore(STORES.REFUGEES, { keyPath: 'temp_id' });
        }
        if (!db.objectStoreNames.contains(STORES.NGO_REQS)) {
          db.createObjectStore(STORES.NGO_REQS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORES.VERIF)) {
          db.createObjectStore(STORES.VERIF, { keyPath: 'passport_number' });
        }
      }
    });
  }
  return _db;
}

// ── QR Cache ──
export async function cacheQRRecord(record: {
  border_id: string; name: string; flag: string;
  nationality: string; visa_type?: string; fraud_type?: string;
}) {
  const db = await getDB();
  await db.put(STORES.QR_CACHE, { ...record, cached_at: new Date().toISOString() });
}

export async function lookupOfflineQR(border_id: string) {
  const db = await getDB();
  return db.get(STORES.QR_CACHE, border_id);
}

export async function getAllCachedQR() {
  const db = await getDB();
  return db.getAll(STORES.QR_CACHE);
}

// ── Scan Logs (offline) ──
export async function addOfflineScanLog(log: {
  border_id: string; passport_number?: string; traveller_name: string;
  result: string; flag: string; timestamp?: string;
}) {
  const db = await getDB();
  await db.add(STORES.SCAN_LOGS, {
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
    synced: false,
  });
}

export async function getPendingScanLogs() {
  const db = await getDB();
  const all = await db.getAll(STORES.SCAN_LOGS);
  return all.filter((r: any) => !r.synced);
}

export async function markScanLogsSynced() {
  const db = await getDB();
  const all = await db.getAll(STORES.SCAN_LOGS);
  const tx  = db.transaction(STORES.SCAN_LOGS, 'readwrite');
  for (const r of all) {
    await tx.store.put({ ...r, synced: true });
  }
  await tx.done;
}

// ── Offline Refugees ──
export async function addOfflineRefugee(refugee: object) {
  const db = await getDB();
  const rec = {
    ...refugee,
    temp_id: `REF-OFFLINE-${Date.now()}`,
    registered_at: new Date().toISOString(),
    synced: false,
  };
  await db.put(STORES.REFUGEES, rec);
  return rec;
}

export async function getPendingRefugees() {
  const db = await getDB();
  const all = await db.getAll(STORES.REFUGEES);
  return all.filter((r: any) => !r.synced);
}

export async function markRefugeesSynced() {
  const db = await getDB();
  const all = await db.getAll(STORES.REFUGEES);
  const tx  = db.transaction(STORES.REFUGEES, 'readwrite');
  for (const r of all) {
    await tx.store.put({ ...r, synced: true });
  }
  await tx.done;
}

// ── Offline NGO Requests ──
export async function addOfflineNGORequest(req: object) {
  const db = await getDB();
  await db.add(STORES.NGO_REQS, {
    ...req,
    requested_at: new Date().toISOString(),
    synced: false,
  });
}

export async function getPendingNGORequests() {
  const db = await getDB();
  const all = await db.getAll(STORES.NGO_REQS);
  return all.filter((r: any) => !r.synced);
}

// ── Verification Results (offline) ──
export async function addOfflineVerifResult(result: object) {
  const db = await getDB();
  await db.put(STORES.VERIF, { ...result, verified_at: new Date().toISOString(), synced: false });
}

export async function getPendingVerifResults() {
  const db = await getDB();
  const all = await db.getAll(STORES.VERIF);
  return all.filter((r: any) => !r.synced);
}

// ── Aggregate counts ──
export async function countCachedRecords(): Promise<number> {
  try {
    const db = await getDB();
    const counts = await Promise.all([
      db.count(STORES.QR_CACHE),
      db.count(STORES.SCAN_LOGS),
      db.count(STORES.REFUGEES),
      db.count(STORES.NGO_REQS),
    ]);
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

export async function countPendingSync(): Promise<number> {
  try {
    const [logs, refs, ngoReqs, verifs] = await Promise.all([
      getPendingScanLogs(),
      getPendingRefugees(),
      getPendingNGORequests(),
      getPendingVerifResults(),
    ]);
    return logs.length + refs.length + ngoReqs.length + verifs.length;
  } catch {
    return 0;
  }
}

export async function getAllOfflineData() {
  const [scanLogs, refugees, ngoRequests, verifResults] = await Promise.all([
    getPendingScanLogs(),
    getPendingRefugees(),
    getPendingNGORequests(),
    getPendingVerifResults(),
  ]);
  return { scanLogs, refugees, ngoRequests, verifResults };
}

export async function getAllCached() {
  const db = await getDB();
  return db.getAll(STORES.QR_CACHE);
}
