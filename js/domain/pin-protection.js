/* LIVRO-CAIXA · js/domain/pin-protection.js — regras puras da Proteção local (PIN/bloqueio).
   Sem DOM, localStorage ou crypto. Módulo ESM: importável em Node (testes)
   e no navegador (<script type="module">). Expõe window.PinProtection como
   global para scripts clássicos do app, sem duplicar lógica. */

// Classifica um valor de localStorage em um resultado inequívoco.
// Diferença obrigatória entre ausência confirmada, registro inválido, erro e válido.
export function classifyPinRecord(raw) {
  if (raw === null) return { exists: false, valid: false, error: 'no_record', record: null };
  let record;
  try { record = JSON.parse(raw); } catch (err) { return { exists: false, valid: false, error: 'parse_error', record: null }; }
  if (record === null) return { exists: true, valid: false, error: 'json_null', record: null };
  if (typeof record !== 'object') return { exists: true, valid: false, error: 'json_type_invalid', record: null };
  const hash = record.hash;
  if (typeof hash !== 'string' || hash.length !== 64) {
    return { exists: true, valid: false, error: 'hash_missing_or_invalid', record };
  }
  return { exists: true, valid: true, error: null, record };
}

// Decide o bloqueio a partir dos parâmetros resolvidos.
// graceMs > 0 só libera com um epoch de atividade válido e recente.
export function evaluateLock(params) {
  const { recordResult, lockOnOpen, graceMs, lastPinActivity, now } = params;

  if (!recordResult.exists) {
    // Ausência de registro: abrir só se a política permitir abertura direta
    return { locked: lockOnOpen !== false, reason: 'no_record', pinUnlocked: lockOnOpen === false };
  }
  if (!recordResult.valid) {
    // Registro inválido/corrompido: fail-closed
    return { locked: true, reason: 'invalid_record', pinUnlocked: false };
  }
  if (graceMs > 0 && typeof lastPinActivity === 'number' && lastPinActivity > 0 && typeof now === 'number' && now >= lastPinActivity && (now - lastPinActivity) < graceMs) {
    return { locked: false, reason: 'within_grace_period', pinUnlocked: true };
  }
  return { locked: true, reason: 'needs_unlock', pinUnlocked: false };
}

// Exposição para scripts clássicos (18-render-core.js) via global no navegador.
if (typeof window !== 'undefined') {
  window.PinProtection = { classifyPinRecord, evaluateLock };
}
