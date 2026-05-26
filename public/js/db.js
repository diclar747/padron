// IndexedDB wrapper for offline storage
const DB_NAME = 'PadronDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('electores')) {
        const store = db.createObjectStore('electores', { keyPath: '_localId', autoIncrement: true });
        store.createIndex('estado', 'estado', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };
  });
}

async function withStore(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

const localDB = {
  async addElector(data) {
    const store = await withStore('electores', 'readwrite');
    return new Promise((resolve, reject) => {
      data._localStatus = data.id ? 'updated' : 'new';
      data.synced = 0;
      data._localId = data._localId || Date.now();
      const req = store.put(data);
      req.onsuccess = () => resolve(data._localId);
      req.onerror = () => reject(req.error);
    });
  },

  async getElectores() {
    const store = await withStore('electores');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getPendientes() {
    const store = await withStore('electores');
    return new Promise((resolve, reject) => {
      const idx = store.index('synced');
      const req = idx.getAll(0);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async markSynced(localId, serverId) {
    const store = await withStore('electores', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.get(localId);
      req.onsuccess = () => {
        const data = req.result;
        if (data) {
          data.id = serverId;
          data.synced = 1;
          data._localStatus = 'synced';
          store.put(data);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deleteElector(localId) {
    const store = await withStore('electores', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(localId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async setConfig(key, value) {
    const store = await withStore('config', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getConfig(key) {
    const store = await withStore('config');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error);
    });
  }
};
