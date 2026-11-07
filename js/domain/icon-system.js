/* LIVRO-CAIXA — resolvedor centralizado de ícones Tabler (domínio).
   Dados em js/data/tabler-icon-catalog.js. Sem DOM, sem storage, sem rede.
   Regra: valor externo NUNCA vira classe CSS sem validação do identificador;
   valores desconhecidos retornam o fallback (id cadastrado), nunca erro. */
import { TABLER_ICON_CATALOG, TABLER_LEGACY_EMOJI_MAP } from '../data/tabler-icon-catalog.js';

const ALLOWLIST = new Set(TABLER_ICON_CATALOG.map((entry) => entry.id));
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREFIX = 'ti-';

export const FALLBACK_ICON = 'star';

function stripPrefix(raw) {
  const normalized = raw.trim().toLowerCase();
  return normalized.startsWith(PREFIX) ? normalized.slice(PREFIX.length) : normalized;
}

export function isValidTablerIcon(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  const id = stripPrefix(trimmed);
  return ID_PATTERN.test(id) && ALLOWLIST.has(id);
}

export function getLegacyIconMapping(value) {
  if (typeof value !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(TABLER_LEGACY_EMOJI_MAP, value)) {
    return TABLER_LEGACY_EMOJI_MAP[value];
  }
  return null;
}

export function resolveIcon(value) {
  if (isValidTablerIcon(value)) return stripPrefix(value.trim());
  const legacy = getLegacyIconMapping(value);
  return legacy ?? FALLBACK_ICON;
}

export function getIconClass(value) {
  return `ti ti-${resolveIcon(value)}`;
}

const LABELS = new Map(TABLER_ICON_CATALOG.map((entry) => [entry.id, entry.label]));

export function getIconLabel(value) {
  const id = resolveIcon(value);
  return LABELS.get(id) ?? null;
}

export function getTablerIconCatalog() {
  return TABLER_ICON_CATALOG.map((entry) => ({ ...entry }));
}

const LC_ICON = {
  FALLBACK_ICON,
  isValidTablerIcon,
  getLegacyIconMapping,
  resolveIcon,
  getIconClass,
  getIconLabel,
  getTablerIconCatalog,
};

globalThis.LC_ICON = LC_ICON;
