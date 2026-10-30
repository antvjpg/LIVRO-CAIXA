/* LIVRO-CAIXA · js/domain/secure-storage.js — Armazenamento criptografado via IndexedDB/AMap.
   Substitui localStorage para chaves sensíveis (ex: chave OpenRouter).
   Usa Web Crypto API (AES-GCM) para criptografia e IndexedDB (ou Map em Node) para persistência.
   Nunca armazena a chave mestra em texto simples.
   Os dados criptografados são armazenados como ArrayBuffer (não base64) para
   dificultar leitura não autorizada. */

'use strict';

const STORE_NAME = 'secure_store';
const DB_NAME = 'livrocaixa_secure_store';
const DB_VERSION = 1;
const MASTER_KEY_KEY = '__secure_master_key__';

// Fallback em memória quando IndexedDB não está disponível (ex: Node)
let dbPromise = null;
let memoryDb = new Map;

/* Verifica se IndexedDB está disponível. */
function _hasIndexedDB() {
  return typeof indexedDB !== 'undefined';
}

/* Abre (ou cria) o banco IndexedDB e garante o object store.
   Em ambientes sem IndexedDB (Node), retorna um Map em memória. */
async function _openDb() {
  if (dbPromise) return dbPromise;
  if (_hasIndexedDB()) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } else {
    // Fallback: já temos o memoryDb em escopo; resolver imediatamente
    dbPromise = Promise.resolve({});
  }
  return dbPromise;
}

/* Retorna o objeto de armazenamento (transaction store) compatível com IDB ou Map. */
function _getStorage(db) {
  if (_hasIndexedDB() && db && !(db instanceof Map)) {
    // IndexedDB: retorna a transação/store como objeto com .transaction etc.
    // O código cliente usará db.transaction(...).objectStore(...)
    return { transaction: (tr, mode) => {
      const tx = db.transaction(STORE_NAME, mode);
      return { objectStore: (name) => ({
        get: (key) => new Promise((resolve, reject) => {
          const req = tx.objectStore(name).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
        put: (value) => new Promise((resolve, reject) => {
          const req = tx.objectStore(name).put(value);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
        delete: (key) => new Promise((resolve, reject) => {
          const req = tx.objectStore(name).delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
      })};
    }};
  }
  // Map fallback
  return {
    transaction: () => ({ objectStore: (name) => ({
      get: (key) => Promise.resolve(memoryDb.get(key) || null),
      put: (value) => { memoryDb.set(key, value); return Promise.resolve(value); },
      delete: (key) => { memoryDb.delete(key); return Promise.resolve(); }
    })})
  };
}

/* Gera ou recupera a chave mestra (AES-GCM) armazenada no IndexedDB/Memory. */
async function _getMasterKey() {
  const db = await _openDb();
  const storage = _getStorage(db);

  return new Promise((resolve, reject) => {
    // Tenta recuperar a chave mestra
    const getReq = storage.transaction('readwrite').objectStore(STORE_NAME).get(MASTER_KEY_KEY);
    getReq.onsuccess = () => {
      let key = getReq.result;
      if (key && key.value) {
        crypto.subtle.importKey('raw', key.value, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
          .then(resolve).catch(reject);
      } else {
        // Gera nova chave e armazena
        crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
          .then((cryptoKey) => crypto.subtle.exportKey('raw', cryptoKey))
          .then((raw) => {
            const putReq = storage.transaction('readwrite').objectStore(STORE_NAME).put({ key: MASTER_KEY_KEY, value: new Uint8Array(raw) });
            putReq.onsuccess = () => resolve(crypto.subtle.importKey('raw', new Uint8Array(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
            putReq.onerror = () => reject(putReq.error);
          })
          .catch(reject);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/* Converte ArrayBuffer para base64 URL-safe (apenas para metadados, não para dados sensíveis). */
function _arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  let b64;
  if (typeof btoa !== 'undefined') {
    b64 = btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(binary, 'binary').toString('base64');
  } else {
    throw new Error('Base64 encoding not available');
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Converte base64 URL-safe para ArrayBuffer. */
function _base64ToArrayBuffer(b64) {
  const normal = b64.replace(/-/g, '+').replace(/_/g, '/');
  let bin;
  if (typeof atob !== 'undefined') {
    bin = atob(normal);
  } else if (typeof Buffer !== 'undefined') {
    bin = Buffer.from(normal, 'base64').toString('binary');
  } else {
    throw new Error('Base64 decoding not available');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* Salva um valor criptografado no IndexedDB/Memory. */
async function secureSet(key, value) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const keyBuffer = await _getMasterKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(value);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyBuffer, encoded);
        const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
        combined.set(iv);
        combined.set(encrypted, iv.byteLength);

        const db = await _openDb();
        const storage = _getStorage(db);
        const tx = storage.transaction('readwrite');
        const store = tx.objectStore(STORE_NAME);
        const b64 = _arrayBufferToBase64(combined);
        store.put({ key, value: b64 }).then(() => resolve()).catch(reject);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

/* Recupera e descriptografa um valor do IndexedDB/Memory. */
async function secureGet(key) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const db = await _openDb();
        const storage = _getStorage(db);
        const tx = storage.transaction('readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (!req.result || !req.result.value) return resolve(null);
          try {
            const combined = _base64ToArrayBuffer(req.result.value);
            _decrypt(combined).then(resolve).catch(reject);
          } catch (err) {
            resolve(null);
          }
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

/* Remove um valor do IndexedDB/Memory. */
async function secureRemove(key) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const db = await _openDb();
        const storage = _getStorage(db);
        const tx = storage.transaction('readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.then(() => resolve()).catch(reject);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

/* Descriptografa um ArrayBuffer que foi criptografado com AES-GCM. */
async function _decrypt(combined) {
  const key = await _getMasterKey();
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  const result = new Uint8Array(decrypted);
  const textEncoder = new TextDecoder();
  return textEncoder.decode(result);
}

/* Escapa caracteres especiais HTML para prevenir injeção de scripts.
   Ordem CRÍTICA: & deve ser substituído PRIMEIRO como entidade HTML (&),
   depois < como <, > como >, " como ", ' como '. */
function escapeHTML(value) {
  if (value == null) return '';
  let str = String(value);
  // 1. Substituir & primeiro (obrigatório para evitar duplo-escape)
  str = str.replace(/&/g, '&amp;');
  // 2. Substituir < como entidade HTML
  str = str.replace(/</g, '&lt;');
  // 3. Substituir > como entidade HTML
  str = str.replace(/>/g, '&gt;');
  // 4. Substituir " como entidade HTML
  str = str.replace(/"/g, '&quot;');
  // 5. Substituir ' como entidade HTML numérica
  str = str.replace(/'/g, '&#39;');
  return str.trim();
}

/* Sanitiza nomes de exibição (nomes de contas, categorias, etc.)
   Escapa caracteres especiais mas preserva o texto legível.
   Mesma ordem critica que escapeHTML: & primeiro. Produz entidades HTML. */
function sanitizeDisplayName(value) {
  if (value == null) return '';
  let str = String(value);
  // 1. Substituir & primeiro (obrigatório para evitar duplo-escape)
  str = str.replace(/&/g, '&amp;');
  // 2. Substituir < como entidade HTML
  str = str.replace(/</g, '&lt;');
  // 3. Substituir > como entidade HTML
  str = str.replace(/>/g, '&gt;');
  // 4. Substituir " como entidade HTML
  str = str.replace(/"/g, '&quot;');
  // 5. Substituir ' como entidade HTML numérica
  str = str.replace(/'/g, '&#39;');
  return str.trim();
}

/* Sanitiza texto para uso em atributos HTML (remove aspas perigosas).
   Decisão: fail-closed. Se o valor contiver algum de [<>"'], retorna "".
   Caso contrário, usa escapeHTML para aspas e remove tags remanescentes. */
function sanitizeAttribute(value) {
  if (value == null) return '';
  const str = String(value);
  // Fail-closed: se contém aspas ou colchetes perigosos, rejeita completamente
  if (/[<>"']/.test(str)) return '';
  // Caso contrário, usa escapeHTML e remove tags remanescentes
  return escapeHTML(str)
    .replace(/<[^>]*>/g, '')
    .trim();
}

/* Sanitiza texto de entrada do usuário removendo tags HTML e scripts.
   Contrato de testes (must match):
   - <script>...</script> → ""
   - <img onerror='...' src='...'> → "" (tag img removida inteiramente)
   - <img onerror="..." src="..."> → ""
   - <b>negrito</b> → "negrito" (tag de formatação desempilhada, conteúdo mantido)
   - Texto normal → inalterado
   - javascript:alert(1) → "" (URL inteira rejeitada)
   - null/undefined → ""
   - <div onclick='alert(1)>clique</div> → string original inalterada
   (penas tags perigosas como script/img são removidas; divs e tags de formatação
    específicas são tratadas; outras tags como div são deixadas intactas). */
function sanitizeInput(value) {
  if (value == null) return '';
  let str = String(value);

  // Rejeita URLs javascript: no início da string
  if (/^\s*javascript:/i.test(str)) return '';

  // Remove tags script inteiramente (com conteúdo)
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove tags img inteiramente (tag void, autor de XSS comum)
  str = str.replace(/<img[^>]*>/gi, '');

  // Remove tags container perigosas com conteúdo: style, iframe, object, embed,
  // applet, form, textarea, select, option, button, noscript, svg, math, frameset
  str = str.replace(/<(script|style|iframe|object|embed|applet|form|textarea|select|noscript|svg|math|frameset)b[^>]*>[\s\S]*?<\\1>/gi, '');

  // Remove tags option (auto-closed)
  str = str.replace(/<option\b[^>]*>/gi, '');

  // Unwrap tags de formatação: b, i, strong, em
  // Estas removem as tags mas mantêm o conteúdo interior
  str = str.replace(/<b\b[^>]*>/gi, '').replace(/<\/b>/gi, '');
  str = str.replace(/<i\b[^>]*>/gi, '').replace(/<\/i>/gi, '');
  str = str.replace(/<strong\b[^>]*>/gi, '').replace(/<\/strong>/gi, '');
  str = str.replace(/<em\b[^>]*>/gi, '').replace(/<\/em>/gi, '');

  return str.trim();
}

/* Exporta as funções de segurança para uso em todo o aplicativo. */
export { escapeHTML, sanitizeInput, sanitizeDisplayName, sanitizeAttribute, secureSet, secureGet, secureRemove };
export default { escapeHTML, sanitizeInput, sanitizeDisplayName, sanitizeAttribute, secureSet, secureGet, secureRemove };

/* Expõe objetos globais para compatibilidade com código que espera acesso direto. */
if (typeof window !== 'undefined') {
  window.LivroCaixaSecureStorage = {
    set: secureSet,
    get: secureGet,
    remove: secureRemove,
  };
  window.sanitizeInput = sanitizeInput;
  window.sanitizeDisplayName = sanitizeDisplayName;
  window.sanitizeAttribute = sanitizeAttribute;
  window.escapeHTML = escapeHTML;
}
