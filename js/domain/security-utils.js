/* LIVRO-CAIXA · js/domain/security-utils.js — Re-exporta funções de segurança do secure-storage.js.
   Mantém compatibilidade com imports existentes sem duplicar lógica. */

export {
  escapeHTML,
  sanitizeInput,
  sanitizeDisplayName,
  sanitizeAttribute,
} from './secure-storage.js';

export { default } from './secure-storage.js';
