/* LIVRO-CAIXA · js/domain/secure-storage.js — utilitários de segurança e armazenamento local.
   Consumido pelo módulo security-utils.js (re-exportação). Sem dependências. */

export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Remove caracteres de controle e sequências perigosas para texto livre.
export function sanitizeInput(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '') // tags HTML
    .replace(/[\x00-\x1F\x7F]/g, '') // caracteres de controle
    .trim()
    .slice(0, 1000);
}

// Nome de exibição: sem HTML, sem controle, sem extensão de arquivo disfarçada.
export function sanitizeDisplayName(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 120);
}

// Atributo HTML: semaspas ou caracteres de quebra.
export function sanitizeAttribute(value) {
  return String(value ?? '')
    .replace(/[\x00-\x1F\x7F"<>&']/g, '')
    .trim()
    .slice(0, 300);
}

// Leitura tolerante do armazenamento local com prefixo próprio.
// Falha de leitura retorna o fallback e nunca lança.
export function getSecureStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem('livrocaixa-secure-' + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

export function setSecureStorage(key, value) {
  try {
    localStorage.setItem('livrocaixa-secure-' + key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

export function removeSecureStorage(key) {
  try {
    localStorage.removeItem('livrocaixa-secure-' + key);
    return true;
  } catch (err) {
    return false;
  }
}

export default {
  escapeHTML,
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeAttribute,
  getSecureStorage,
  setSecureStorage,
  removeSecureStorage,
};
