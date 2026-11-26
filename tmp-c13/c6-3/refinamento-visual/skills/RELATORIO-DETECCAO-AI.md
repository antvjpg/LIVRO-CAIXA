# Detecção de “AI look” — skills executadas sobre a aba Início

## 1. Objetivo

Auditar o estado atual da aba Início do LIVRO-CAIXA quanto a padrões visuais genéricos de interfaces geradas por IA, usando skills especializadas encontradas na web. Execução somente leitura: nenhum código da aplicação foi alterado.

## 2. Metodologia

1. **Busca local:** nenhuma skill instalada detecta especificamente “AI look”. A skill local mais próxima é `web-design-guidelines` (Vercel), carregada manualmente porque a ferramenta `skill` falhou com `ripgrep execution failed`.
2. **Busca na web:** encontradas `funboy322/avoid-ai-design`, `airtaxi/frontend-slop-guard`, `XSW-1123/ui-craft`, `rwcod/anti-ai-slop-ui`, `pbakaus/impeccable` e outras.
3. **Download:** quatro repositórios com modos detect/audit foram clonados em `/data/data/com.termux/files/usr/tmp/opencode/skills/` com `git clone --depth 1`. Nada foi instalado globalmente e nada foi escrito no projeto.
4. **Inspeção prévia:** li os `SKILL.md` e os scripts antes de executar. Node `v26.12.1`.
5. **Execução:**
   - `avoid-ai-design/scripts/detect.mjs --min=P2` sobre `index.html`, `style/features.css`, `style/themes.css`, `style/base.css` e `style/layout.css` (modo detect, sem edições).
   - `ui-craft/scripts/audit.mjs` e `score.mjs` sobre uma cópia temporária apenas dos arquivos da Início (`index.html`, quatro CSS e o spec), para evitar ruído de backups e relatórios.
   - Checklists manuais de `frontend-slop-guard` e `anti-ai-slop-ui` aplicadas ao estado renderizado.
6. **Render:** capturas CDP já produzidas em `../corrigido4/prints/` foram usadas para julgar os tells visuais e aplicar o teste da silhueta (redução a 25% + detecção de bordas com Pillow).
7. **Critério interpretativo:** achados de scanner são candidatos, não prova de autoria nem defeito confirmado. Padrões pedidos pelo produto ou existentes no design system foram marcados como justificados.

## 3. Comandos executados

```bash
node .../avoid-ai-design/scripts/detect.mjs --min=P2 index.html style/features.css style/themes.css style/base.css style/layout.css
node .../avoid-ai-design/scripts/detect.mjs --json --min=P2 ...
node .../ui-craft/scripts/audit.mjs <target> --json
node .../ui-craft/scripts/score.mjs <target> --json
```

Saídas salvas em `skills/`: `avoid-ai-design.txt`, `avoid-ai-design.json`, `ui-craft-audit.json`, `ui-craft-score.json`, `ui-craft-inicio-audit.json`, `ui-craft-inicio-score.json` e as silhuetas.

## 4. Resultados por skill

### 4.1 avoid-ai-design (detect)

- **20 achados:** P0 1, P1 14, P2 5.
- **Stack por arquivo:** `features.css` 5, `themes.css` 2, `base.css` 3, `layout.css` 3 — nenhum atinge o limite de 6 que caracteriza template.
- **P0:** `T1 Inter as the primary face` em `features.css:295`.
  - **Avaliação:** falso positivo para a Início. A linha é `body[data-font="inter"]` / toggle de fonte do Perfil; o padrão da aplicação é `Plus Jakarta Sans`.
- **P1 recorrentes:**
  - `K2` raio+sombra uniformes em várias superfícies — padrão do design system existente; manter, mas é um candidato legítimo de achatamento de hierarquia.
  - `K3` glassmorphism — bottom nav e overlays/modais; justificado por camadas sobrepostas.
  - `SD4` labels uppercase com tracking — linguagem já adotada pelo produto; justificado.
- **P2:** hover em cards e labels “WORD — fragment”; fora do escopo da Início ou históricos.

### 4.2 ui-craft (audit/score)

Varredura completa do repositório: 121 arquivos, 16 BLOCKING, 792 WARN, 212 SLOP, Slop Index 51.

Varredura focada nos 6 arquivos da Início:

| Métrica | Valor |
|---|---:|
| BLOCKING | 10 |
| WARN | 529 |
| SLOP | 31 |
| INFO | 9 |
| Slop Index | 79 (“is the default”) |
| Cores únicas | 174 |
| Valores de espaçamento | 124 |
| Fontes | Plus Jakarta Sans, Inter, Segoe UI Symbol, Noto Sans Symbols, Georgia |

`score.mjs`: total 10 (teto), Content 10/10 (sem placeholder copy), demais dimensões zeradas pelo volume de candidatos.

BLOCKING mais relevantes:

- `focus-removed` em `base.css:128`, `features.css:101`, `679`, `2325`, `2750`, `3025`, `7295`, `7298`.
  - **Avaliação:** candidatos. Os trechos inspecionados substituem `outline` por `border-color` + `box-shadow` em estados `:focus`, portanto podem ser válidos. Confirmação exige teste de teclado renderizado, não apenas scanner.
- `flash-rate` em `features.css:784` — animação `v1616-pulse` de 1,2s contínua usada no skeleton de carregamento.
  - **Avaliação:** fora da Início e provavelmente falso positivo de frequência; skeleton existente.
- `no-reduced-motion` em `layout.css` — problema global histórico, não introduzido nesta rodada.

SLOP mais relevantes:

- `glassmorphism` em bottom nav/modal — justificado.
- `three-equal-cards` em vários pontos — na Início, o grid de cards foi sobrescrito para largura total + 2 colunas; os `repeat(3)` restantes pertencem a indicadores/métricas, não ao herói.
- `emoji-as-icon` —主要在 áreas fora da Início; a Início usa ícones `fi` consistentes.
- `inter-default` — toggle opcional de fonte, não o padrão da Início.

### 4.3 frontend-slop-guard (checklist manual)

| Tell | Resultado na Início |
|---|---|
| Gradientes | Um gradiente suave no Patrimônio Total; sem gradiente de texto; não é abuso. |
| Rainbow vomit | Cores vêm dos tokens de tema; papéis semânticos definidos. Sem arco-íris. |
| Badges pulsantes/redundantes | Nenhum na Início. |
| Fingernail cards | Nenhuma borda colorida unilateral. |
| Emoji slop | Nenhum ícone emoji na Início; conjunto `fi` consistente. |
| Alinhamento | Cabeçalho, cards e indicadores alinhados por grid/flex; ver capturas. |
| Fontes | Plus Jakarta Sans como padrão; Inter apenas opção explícita. |
| Texto redundante de chat | Nenhum. |
| Glassmorphism | Apenas bottom nav, justificado por sobreposição. |
| Taglines hype | Nenhuma; textos funcionais (“Início”, “Seu momento financeiro”, “Próximo pagamento”). |
| Middle dot | Presente no rodapé global (“livro-caixa · dados sincronizados…”), fora da composição da Início e pré-existente. |
| Card dentro de card | Resolvido: `.next-pay-inner` sem borda/fundo próprios. |
| Glows radiais | Nenhum na Início após a correção. |
| Eyebrow kickers | “Seu momento financeiro” é diagnóstico funcional da Saúde Financeira, não kicker de marketing. |

### 4.4 anti-ai-slop-ui (checklist manual)

- **Classificação:** app dashboard / tela financeira.
- **Direção concreta:** Financial Dashboard —— tokens semânticos, superfícies neutras com leve diferenciação, hierarquia por peso e tamanho, não por cor.
- **Layout:** resumo financeiro —— Patrimônio Total, faixa hierárquica e módulos secundários; não é o template “hero central + três cards”.
- **Gate anti-slop:**
  - Não há paleta purple/neon.
  - Cards não são três iguais; há largura total, 2-colunas e módulos internos distintos.
  - Ícones consistentes.
  - Sem bento decorativo e sem motion decorativa.
  - Sem card aninhado após a remoção do contorno interno.
  - Mini seletor de tema reusa componentes existentes, sem novo sistema.

### 4.5 Teste da silhueta

Silhuetas em `skills/silhueta-inicio-390x844-*.png`: a forma é a de um dashboard financeiro com bloco principal, faixa hierárquica e módulos inferiores. Não é a silhueta genérica de landing page com herói centralizado e três cards iguais. Isso é evidência visual de apoio, não aprovação automática.

## 5. Conclusão

- Nenhuma das skills encontrou um P0 real na aba Início. O único P0 do `avoid-ai-design` é um falso positivo de fonte opcional.
- Os achados restantes são主要mente padrões globais históricos ou escolhas justificadas pelo design system/bottom nav/métricas.
- A aba Início atual não apresenta os tells clássicos de “AI look”: não há purple/neon, não há três cards idênticos, não há card aninhado, não há emoji-icon, não há glow/aurora e não há copy de hype.
- O Slop Index alto do `ui-craft` é influenciado por 174 cores e 124 valores de espaçamento no conjunto de arquivos, majoritariamente fora da composição da Início. Não justifica reescrita ampla nesta etapa.

## 6. Limitações

- `impeccable` e `hallmark` não foram executados porque exigem instalação/hooks que poderiam alterar a configuração do projeto; não foram baixados.
- A ferramenta `skill` do OpenCode falhou; as skills foram carregadas por leitura direta dos `SKILL.md`.
- Detectores estáticos não provêm defeitos renderizados; os candidatos `focus-removed` precisam de validação de teclado no E2E oficial.

## 7. Estado final

Nenhum arquivo do projeto foi alterado por esta auditoria de skills. Os artefatos estão apenas em `tmp-c13/c6-3/refinamento-visual/skills/` e no diretório temporário de skills.
