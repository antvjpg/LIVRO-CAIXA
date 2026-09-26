/* Validação compartilhada do Worker.

   1) Entrada do corpo enviado pelo index.html ao POST /ai: nada é
      encaminhado ao OpenRouter antes de passar por estes limites. Campos
      desconhecidos do payload são ignorados — apenas "prompt",
      "imagePart" e "maxTokens" são lidos.
   2) Datas "YYYY-MM-DD" do gateway financeiro (BCB/Tesouro): validação
      estrita e conversões de formato, sem regra de negócio financeira. */

/* Teto do corpo da requisição.
   O frontend autoriza comprovante de até 15 MB (PDF) que vira data URL
   base64 ≈ 21 MB; 24 MiB cobre esse caso com folga e mantém o corpo bem
   abaixo do limite de requisição do Cloudflare Workers (100 MB). */
export const MAX_BODY_BYTES = 24 * 1024 * 1024;

/* Teto de caracteres do prompt.
   Maiores usos atuais: leitura de comprovante (~3 KB) e diagnóstico
   financeiro (instruções ~5 KB + snapshot agregado, tipicamente 2–15 KB).
   60 000 chars ≈ 3–6× essa margem e ainda cabe no contexto dos modelos
   free (≈32k tokens) com folga para tokenização em português. */
export const MAX_PROMPT_CHARS = 60000;

/* Teto de geração preservado do Worker original. O index.html já envia
   maxTokens inteiro entre 1 e 4096 (padrão do cliente). */
export const MAX_TOKENS_CAP = 4096;

/* Mesmos limites que o frontend aplica antes de enviar: imagem 7 MB,
   PDF 15 MB (RECEIPT_MAX_SIZE / TRANSFER_RECEIPT_MAX_SIZE). */
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

/* Só data URLs locais são aceitas. O index.html hoje envia exclusivamente
   estes tipos; nenhuma URL http(s) é encaminhada (evita transformar o
   Worker em proxy de URL arbitrária). */
const ALLOWED_DATA_URL_TYPES = {
  "image/jpeg": MAX_IMAGE_BYTES,
  "image/png": MAX_IMAGE_BYTES,
  "image/webp": MAX_IMAGE_BYTES,
  "application/pdf": MAX_PDF_BYTES
};

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(status, error, code, extra) {
  return Object.assign({ ok: false, status, body: { error, code } }, extra || {});
}

/* Lê o corpo respeitando MAX_BODY_BYTES e faz o parse do JSON.
   content-length é a checagem primária (exata, evita ler corpo grande);
   text.length é a salvaguarda para requisições sem esse header
   (unidades UTF-16 ≤ bytes UTF-8, portanto sempre conservadora). */
export async function readJsonBody(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail(
      413,
      `Corpo da requisição acima do limite de ${Math.floor(MAX_BODY_BYTES / (1024 * 1024))} MB.`,
      "payload_too_large"
    );
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return fail(
      413,
      `Corpo da requisição acima do limite de ${Math.floor(MAX_BODY_BYTES / (1024 * 1024))} MB.`,
      "payload_too_large"
    );
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (bodyError) {
    return fail(400, "Corpo da requisição inválido.", "bad_body");
  }

  if (!isPlainObject(payload)) {
    return fail(400, "Corpo da requisição inválido.", "bad_body");
  }

  return { ok: true, payload };
}

function decodedBase64Bytes(base64Length, padding) {
  return Math.max(0, Math.floor((base64Length * 3) / 4) - padding);
}

/* Valida imagePart.
   Ausente/nulo ⇒ sem imagem (comportamento atual). Presente ⇒ estrutura
   e limites obrigatórios: data URL, tipo permitido, base64 com tamanho
   decodificado dentro do teto do tipo. */
function validateImagePart(imagePart) {
  if (imagePart === null || imagePart === undefined) {
    return { ok: true, imageUrl: null };
  }

  if (!isPlainObject(imagePart) || !isPlainObject(imagePart.image_url)) {
    return fail(
      400,
      'Imagem inválida: "imagePart.image_url" deve ser um objeto com o campo "url".',
      "invalid_image"
    );
  }

  const url = imagePart.image_url.url;
  if (typeof url !== "string" || !url) {
    return fail(400, 'Imagem inválida: "image_url.url" deve ser uma string não vazia.', "invalid_image");
  }

  if (!url.startsWith("data:")) {
    return fail(400, "Imagem inválida: apenas data URLs locais são aceitas.", "invalid_image");
  }

  /* Parse manual do data URL: evita copiar o base64 (corpo de até ~21 MB). */
  const separator = url.indexOf(",");
  if (separator <= 0) {
    return fail(400, "Imagem inválida: formato data URL base64 esperado.", "invalid_image");
  }

  const header = url.slice(0, separator);
  if (!header.startsWith("data:") || !header.endsWith(";base64")) {
    return fail(400, "Imagem inválida: formato data URL base64 esperado.", "invalid_image");
  }

  const mediaType = header.slice(5, header.length - ";base64".length).toLowerCase();
  const maxBytes = ALLOWED_DATA_URL_TYPES[mediaType];

  if (!maxBytes) {
    /* Tipo limitado a 32 chars: nada de ecoar conteúdo arbitrário no erro. */
    const label = String(mediaType || "").slice(0, 32) || "desconhecido";
    return fail(400, `Formato de imagem não suportado: ${label}.`, "invalid_image");
  }

  const base64Length = url.length - separator - 1;
  if (base64Length <= 0 || base64Length % 4 !== 0) {
    return fail(400, "Imagem inválida: conteúdo base64 malformado.", "invalid_image");
  }

  const lastChar = url.charCodeAt(url.length - 1);
  const previousChar = url.charCodeAt(url.length - 2);
  const padding = lastChar === 61 ? (previousChar === 61 ? 2 : 1) : 0;
  const bytes = decodedBase64Bytes(base64Length, padding);

  if (bytes > maxBytes) {
    return fail(
      413,
      `Anexo muito grande: limite de ${Math.floor(maxBytes / (1024 * 1024))} MB para ${mediaType}.`,
      "image_too_large"
    );
  }

  return { ok: true, imageUrl: url };
}

/* Normaliza e valida o payload de /ai.
   Retorna { ok, value } com { prompt, imageUrl, maxTokens } prontos para
   uso, ou { ok:false, status, body } já no formato de erro do contrato. */
export function validateAiPayload(payload) {
  if (!isPlainObject(payload)) {
    return fail(400, "Corpo da requisição inválido.", "bad_body");
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return fail(400, "Prompt vazio para a análise de IA.", "empty_prompt");
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return fail(
      400,
      `Prompt acima do limite de ${MAX_PROMPT_CHARS} caracteres.`,
      "prompt_too_long"
    );
  }

  /* maxTokens é obrigatório e deve ser inteiro em [1, MAX_TOKENS_CAP].
     O index.html sempre envia um inteiro já limitado a 4096. */
  const maxTokens = payload.maxTokens;
  if (
    typeof maxTokens !== "number" ||
    !Number.isFinite(maxTokens) ||
    !Number.isInteger(maxTokens) ||
    maxTokens <= 0 ||
    maxTokens > MAX_TOKENS_CAP
  ) {
    return fail(
      400,
      `maxTokens inválido: use um número inteiro entre 1 e ${MAX_TOKENS_CAP}.`,
      "invalid_max_tokens"
    );
  }

  const image = validateImagePart(payload.imagePart);
  if (!image.ok) return image;

  return { ok: true, value: { prompt, imageUrl: image.imageUrl, maxTokens } };
}

/* =====================================================================
   Datas "YYYY-MM-DD" — usadas pelo gateway financeiro (BCB e Tesouro).
   Formato estrito + validade calendário, tudo em UTC puro: nenhuma
   conversão de timezone e nenhuma regra financeira aqui.
   ===================================================================== */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_VALID_YEAR = 1900;
const MAX_VALID_YEAR = 2100;

export function isISODateFormat(value) {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value);
}

export function isValidISODate(value) {
  if (!isISODateFormat(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < MIN_VALID_YEAR || year > MAX_VALID_YEAR) return false;
  const rebuilt = new Date(Date.UTC(year, month - 1, day));
  return (
    rebuilt.getUTCFullYear() === year &&
    rebuilt.getUTCMonth() === month - 1 &&
    rebuilt.getUTCDate() === day
  );
}

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function isoToUTC(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDaysISO(value, days) {
  const date = new Date(isoToUTC(value) + days * 86400000);
  return date.toISOString().slice(0, 10);
}

/* Diferença em dias: diffDaysISO("2026-01-01", "2026-01-11") === 10 */
export function diffDaysISO(from, to) {
  return Math.round((isoToUTC(to) - isoToUTC(from)) / 86400000);
}

/* 2026-09-26 → 26/09/2026 (formato do SGS/BCB) */
export function isoToBrDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/* 26/09/2026 → 2026-09-26; null quando malformada ou impossível. */
export function brDateToIso(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ""));
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidISODate(iso) ? iso : null;
}
