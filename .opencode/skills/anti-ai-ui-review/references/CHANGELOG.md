# Histórico de versões

## 1.0.0 — 26/11/2026

Versão inicial.

- Skill local criada em `.opencode/skills/anti-ai-ui-review/`.
- Detector `scripts/detect.mjs` com regras T1–T13.
- Catálogo `references/TELLS.md`.
- Fontes em `references/SOURCES.md`.
- Validação documental em `VALIDACAO.md`.

Limitações identificadas na auditoria posterior:

- IDs T3 em diante divergiam entre catálogo e detector.
- `transition: all` era classificado como P1.
- Fontes opcionais podiam ser confundidas com fonte principal.
- Regras de foco, movimento reduzido e conteúdo tinham contexto insuficiente.
- A documentação afirmava análise de capturas sem implementá-la.
- Slop Index era tratado como sinal de aprovação.
- Código de saída podia reprovar auditoria por candidatos não confirmados.

Os relatórios e métricas da v1.0.0 permanecem preservados em `tmp-c13/c6-3/refinamento-visual/`.

## 1.1.0 — em implementação

Foco: corrigir metodologia, rastreabilidade e classificação.

- IDs estáveis por domínio.
- Severidade, confiança e status separados.
- Regras rendered-only marcadas como não suportadas.
- `transition: all` reclassificado como P2/candidato.
- Slop Index desativado como critério.
- Testes automatizados próprios do detector.
- `--self-check` para sincronizar detector e documentação.
- Códigos de saída documentados.
