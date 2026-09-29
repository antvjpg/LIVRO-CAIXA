#!/usr/bin/env bash
# C.O.D.E. — EOL do runner/toolchain e supply chain das Actions pinadas.
# Fontes públicas apenas (git ls-remote + API do GitHub): nenhum segredo.
# Os avisos são a entrega (Annotations + Summary). Toda verificação que não
# executa vira ::error:: e derruba o job — nunca sucesso silencioso.

set -euo pipefail

RAIZ="${GITHUB_WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$RAIZ"

resumo() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"
  else
    printf '%s\n' "$1"
  fi
}
aviso() { printf '::warning::%s\n' "$1"; resumo "- ⚠️ $1"; }
falha() { printf '::error::%s\n' "$1"; resumo "- ❌ $1"; }
ok()    { printf '%s\n' "$1"; resumo "- ✅ $1"; }

erros=0

# ---------- 1) runner e toolchain ----------
resumo "## EOL — runner e toolchain"
alvos=(
  "Runner ubuntu-24.04|2029-04-30|manutenção padrão do Ubuntu 24.04 LTS; o GitHub pode anunciar a deprecation do runner label antes dessa data"
  "Node.js 24|2028-04-30|fim do LTS usado em node-version nos workflows"
)
for item in "${alvos[@]}"; do
  IFS='|' read -r nome data nota <<< "$item"
  alvo=$(date -u -d "$data" +%s)
  agora=$(date -u +%s)
  dias=$(((alvo - agora) / 86400))
  if [ "$dias" -lt 0 ]; then
    aviso "$nome: EOL em $data (vencido) — substituir. $nota"
  elif [ "$dias" -le 90 ]; then
    aviso "$nome: EOL em $data — faltam $dias dias. $nota"
  else
    ok "$nome: EOL em $data — faltam $dias dias."
  fi
done

# ---------- 2) Actions pinadas ----------
resumo "## Supply chain — Actions pinadas em .github/workflows"
declare -A verificadas=()
while IFS= read -r linha; do
  limpa=$(printf '%s' "$linha" | sed -E 's/^[[:space:]]*-?[[:space:]]*//')
  case "$limpa" in
    uses:*) ;;
    *) continue ;;
  esac

  acao=$(sed -E 's/^uses:[[:space:]]*([^@[:space:]]+)@.*/\1/' <<< "$limpa")
  sha=$(sed -E 's/^uses:[[:space:]]*[^@[:space:]]+@([0-9a-f]{40})([^0-9a-f].*)?$/\1/' <<< "$limpa")
  tag=""
  if printf '%s' "$limpa" | grep -q '#'; then
    tag=$(sed -E 's/.*#[[:space:]]*([^[:space:]]+).*/\1/' <<< "$limpa")
  fi

  if [ "$sha" = "$limpa" ] || [ "$sha" = "$acao" ]; then
    falha "Action sem pin por SHA: $limpa"
    erros=$((erros + 1))
    continue
  fi
  if [ -z "$tag" ] || [ "$tag" = "$limpa" ]; then
    falha "Pin sem tag documentada no comentário (# v?) : $limpa"
    erros=$((erros + 1))
    continue
  fi

  # Mesma action + mesmo SHA em vários workflows: verifica uma única vez.
  if [ -n "${verificadas[$acao@$sha]:-}" ]; then
    continue
  fi
  verificadas[$acao@$sha]=1

  # Tag anotada tem peel (^{}); a comparação usa o commit, não o objeto da tag.
  status=0
  tags=$(git ls-remote --tags "https://github.com/$acao") || status=$?
  if [ "$status" -ne 0 ]; then
    falha "git ls-remote falhou para $acao (rede) — verificação de supply chain não executada."
    erros=$((erros + 1))
    continue
  fi
  atual=$(awk -v t="refs/tags/$tag" '$2 == t {print $1}' <<< "$tags")
  peel=$(awk -v t="refs/tags/$tag^{}" '$2 == t {print $1}' <<< "$tags")
  if [ -n "$peel" ]; then
    atual=$peel
  fi
  if [ -z "$atual" ]; then
    falha "Tag $acao@$tag não existe mais (removida/yanked)."
    erros=$((erros + 1))
    continue
  fi
  if [ "$atual" != "$sha" ]; then
    falha "Tag $acao@$tag reescrita: pinado $sha mas a tag aponta para $atual — revisar antes de atualizar."
    erros=$((erros + 1))
    continue
  fi
  ok "$acao@$tag → $sha (tag estável)"

  # Nova major disponível = aviso de possível deprecation da major pinada.
  status=0
  ultima=""
  if resp=$(curl -fsS --max-time 20 "https://api.github.com/repos/$acao/releases/latest"); then
    ultima=$(sed -nE 's/.*"tag_name": *"([^"]+)".*/\1/p' <<< "$resp" | sed -n '1p')
  else
    status=1
  fi
  if [ "$status" -ne 0 ] || [ -z "$ultima" ]; then
    aviso "$acao: última release não consultada (rate limit/offline) — checagem de major pulada."
    continue
  fi
  m_pin=${tag#v}
  m_pin=${m_pin%%.*}
  m_new=${ultima#v}
  m_new=${m_new%%.*}
  if [[ "$m_pin" =~ ^[0-9]+$ && "$m_new" =~ ^[0-9]+$ ]]; then
    if [ "$m_new" -gt "$m_pin" ]; then
      aviso "$acao: nova major $ultima disponível (pinado em $tag) — avaliar upgrade/deprecation."
    else
      ok "$acao: major pinada ($tag) é a mais recente ($ultima)."
    fi
  fi
done < <(grep -h 'uses:' .github/workflows/*.yml)

if [ "$erros" -gt 0 ]; then
  falha "$erros verificação(ões) de supply chain não passaram — ver Annotations."
  exit 1
fi
ok "Supply chain íntegra: todas as Actions pinadas por SHA com tag estável."
