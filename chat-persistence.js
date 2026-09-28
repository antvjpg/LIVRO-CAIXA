/* LIVRO-CAIXA — Persistência de histórico do chat no IndexedDB.
   Chave por UID: cada conta tem seu histórico isolado.
   Não persiste: pending, busy, quickSuggestions (são transitórios). */

const DB_NAME = 'LivroCaixaChat';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'accountId' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function loadChatSession(accountId) {
  if (!accountId) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(accountId);
      request.onsuccess = () => {
        const data = request.result;
        if (data && data.messages && Array.isArray(data.messages)) {
          resolve({
            messages: data.messages,
            sessionId: data.sessionId || 0,
            updatedAt: data.updatedAt
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[chat-persistence] load falhou:', err);
    return null;
  }
}

export async function saveChatSession(accountId, sessionId, messages) {
  if (!accountId) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({
        accountId,
        sessionId,
        messages: messages.slice(),
        updatedAt: Date.now()
      });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[chat-persistence] save falhou:', err);
  }
}

export async function clearChatSession(accountId) {
  if (!accountId) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(accountId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[chat-persistence] clear falhou:', err);
  }
}

export async function clearAllChatSessions() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[chat-persistence] clearAll falhou:', err);
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.LivroCaixaChatPersistence = {
    onLoad: loadChatSession,
    onSave: saveChatSession,
    onClear: clearChatSession
  };
}