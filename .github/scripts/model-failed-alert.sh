#!/usr/bin/env bash
set -euo pipefail

janela="${JANELA_MINUTOS:-75}"
if ! printf '%s' "$janela" | grep -Eq '^[0-9]+$' || [ "$janela" -lt 1 ]; then
  echo "::error::JANELA_MINUTOS inválida: ${janela} (esperado inteiro >= 1)"
  exit 1
fi

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID ausente}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN ausente}"
: "${GH_TOKEN:?GH_TOKEN ausente}"

agora_ms=$(( $(date +%s) * 1000 ))
de_ms=$(( agora_ms - janela * 60000 ))
url="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query"
resposta=$(mktemp)
mensagens=$(mktemp)
corpo=$(mktemp)
trap 'rm -f "$resposta" "$mensagens" "$corpo"' EXIT

detalhar_erros() {
  jq -r '(.errors // []) | if length == 0 then "sem detalhe de erro no corpo" else .[] | if type == "object" then "\(.code // "?"): \(.message // "?")" else tostring end end' "$resposta"
}

consultar() {
  local payload="$1"
  local status
  status=$(curl -sS -o "$resposta" -w '%{http_code}' \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H 'Content-Type: application/json' \
    --data "$payload" \
    "$url")
  if [ "$status" != "200" ]; then
    echo "::error::Telemetry query retornou HTTP ${status} — verifique a permissão Workers Observability Write do token CLOUDFLARE_API_TOKEN e o bloco [observability] enabled em worker/wrangler.toml."
    detalhar_erros
    exit 1
  fi
  if ! jq -e '.success == true' "$resposta" > /dev/null; then
    echo "::error::Telemetry query devolveu success=false — verifique filtros e permissão do token."
    detalhar_erros
    exit 1
  fi
}

extrair_mensagens() {
  jq -r '
    def caixa: (.result.events // {}) as $e
      | (if ($e | type) == "array" then $e else ($e.events // []) end);
    caixa[] | .["$metadata"].message // empty
  ' "$1"
}

payload_filtrado=$(jq -nc --argjson de "$de_ms" --argjson ate "$agora_ms" '{
  queryId: "model-failed-alerta",
  view: "events",
  limit: 50,
  timeframe: {from: $de, to: $ate},
  parameters: {
    filterCombination: "and",
    filters: [
      {key: "$metadata.message", operation: "includes", type: "string", value: "model_failed", kind: "filter"}
    ]
  }
}')

payload_total=$(jq -nc --argjson de "$de_ms" --argjson ate "$agora_ms" '{
  queryId: "model-failed-alerta-total",
  view: "events",
  limit: 1,
  timeframe: {from: $de, to: $ate},
  parameters: {filterCombination: "and"}
}')

consultar "$payload_filtrado"
extrair_mensagens "$resposta" > "$mensagens"
total_filtrado=$(wc -l < "$mensagens" | tr -d '[:space:]')

consultar "$payload_total"
total_janela=$(jq -r '
  ((.result.events.count? | select(type == "number"))
    // (.result.events | if type == "array" then length
      else ((.events // []) | length) end)
    // 0)
' "$resposta")

resumo="${GITHUB_STEP_SUMMARY:-}"
if [ -n "$resumo" ]; then
  {
    echo "## model_failed (Workers Logs)"
    echo ""
    echo "- Janela: últimos ${janela} min (de ${de_ms} a ${agora_ms} ms)"
    echo "- Ocorrências de model_failed: ${total_filtrado}"
    echo "- Eventos de log na janela: ${total_janela}"
    if [ "$total_janela" = "0" ]; then
      echo "- Nota: nenhum log na janela — worker ocioso ou Workers Logs desabilitado; valide com workflow_dispatch."
    fi
  } >> "$resumo"
fi

if [ "$total_filtrado" = "0" ]; then
  echo "Nenhuma ocorrência de model_failed nos últimos ${janela} min."
  exit 0
fi

{
  echo "## model_failed detectado (Workers Logs)"
  echo ""
  echo "- Janela: últimos ${janela} min (de ${de_ms} a ${agora_ms} ms)"
  echo "- Ocorrências: ${total_filtrado}"
  echo "- Eventos de log na janela: ${total_janela}"
  echo "- Workflow: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID:-}"
  echo ""
  echo "### Mensagens (até 10)"
  echo '```'
  head -n 10 "$mensagens"
  echo '```'
} > "$corpo"

gh label create alerta-model-failed \
  --color d73a4a \
  --description "model_failed detectado pelo workflow model-failed-alert" \
  --force

numero=$(gh issue list --label alerta-model-failed --state open --json number --jq '.[0].number // empty')

if [ -n "$numero" ]; then
  gh issue comment "$numero" --body-file "$corpo"
  echo "Issue #${numero} comentado com ${total_filtrado} ocorrência(s) de model_failed."
else
  gh issue create \
    --title "Alerta: model_failed na IA (Workers Logs)" \
    --label alerta-model-failed \
    --body-file "$corpo"
fi
