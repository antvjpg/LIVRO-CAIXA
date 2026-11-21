# C.1 — Auditoria de carregamento e cobertura CSS

**Execução:** 21/11/2026 · branch `feat/app-layout-redesign` · HEAD `95b92c6aaf059f4d224dddc478ef201a2b31f503` (baseline C.0 validado em `2568b19`).
**Natureza:** auditoria somente leitura. **Nenhuma regra CSS, token, HTML ou JS foi alterado.**

## 1. Documentação de variáveis existente — resposta direta

**Sim.** A fonte canônica é `docs/design-system/DOCUMENTACAO_VARIAVEIS_CSS.md` (antiga `docs/DOCUMENTACAO_VARIAVEIS_CSS.md`), classificada em `docs/README.md:30` como **referência vigente**, com a ressalva de que o código prevalece.

Ela declara explicitamente (linha 14): "referência/especificação de tokens e temas — não é auditoria, relatório de implementação nem evidência de aprovação. Nenhum teste foi executado para produzir este inventário".

Documentação de apoio:
- `docs/README.md:30,51` — índice e regra de links ao mover arquivos.
- `docs/design-system/auth-overlay/AUTHOVERLAY-EVOLUCAO-VISUAL.md:46` — uso de `--shadow-lg` e cascata do AuthOverlay.
- `docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md:67,114,131` — D-05 com grid responsivo e tokens existentes.
- `docs/auditorias/c4-v05-b/INDICE-EVIDENCIAS.md:3` e `METODOLOGIA-R2*.md` — auditoria runtime de contraste de `--accent`.

**Não existe documento dedicado a breakpoints** em `docs/`; o tema só é citado marginalmente.

## 2. Carregamento CSS

Runtime confirmou **10 folhas**: 7 locais (6 em `style/` + `vendor/tabler-icons/tabler-icons.css`) e 3 externas (Google Fonts + 2 Flaticon). Ordem local observada = esperada:

`themes.css?v=20-23` → `base.css?v=20-24` → `components.css?v=20-33` → `layout.css?v=20-36` → `features.css?v=20-31` → `dashboard-chat.css?v=20-24` → `vendor/tabler-icons/tabler-icons.css`.

`style/styles.css` não existe; referências sobrevivem apenas em comentários de cabeçalho (`base.css:1`, `components.css:1`, `layout.css:1`, `features.css:1`) e em backups não carregados. Há teste de guarda em `worker/test/style-layout.test.mjs:37,53`.

## 3. Tokens

| Métrica | Valor |
|---|---|
| Variáveis distintas definidas em `style/*.css` | 113 |
| Definidas em `themes.css` | 96 |
| Globais | 97 |
| Locais de componente | 16 (15 em CSS + inline via JS) |
| Definidas mas sem consumo `var(--…)` encontrado | 18 (14 globais + 4 locais) |

O inventário documentado confere com o código: nomes de folhas, 5 temas claros + 5 escuros, valores root (`--accent`, `--paper`, `--ink`, `--z-modal`), aliases `--accent-soft`/`--accent-muted` removidos no CSS ativo e a regra de pareamento `--accent-foreground`/`--surface-accent` (`DOCUMENTACAO_VARIAVEIS_CSS.md:204,213`; `layout.css:546`).

**Ressalvas:** aliases removidos sobrevivem em `style/features.css.bak:103,944` (não carregado); a frase "coleta completa de consumidores de `--accent` bloqueada" convive com a coleta técnica C.4 de 6.660 amostras — aparentemente o bloqueio é de **aprovação independente**, não da coleta.

## 4. Breakpoints e comportamento responsivo

- 65 `@media` no código; 63 visíveis no CSSOM runtime. Desses, **15 são condições de largura** (`min-width`/`max-width`).
- Varredura ampliada: **42 larguras** (limiares ±1 px, de 320 a 1440) cobrindo **15/15 condições de largura**, com **0 overflow horizontal**. Condições ambientais (`prefers-reduced-motion`, `max-height`) foram registradas, não exigem ativação por largura.
- `#viewInicio .inicio-grid`: `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`, `gap:14px`; medição real: **1 coluna em mobile**, **3 colunas em desktop**.
- `bottom-nav`: `display:grid` em mobile, `display:none` em desktop — coerente.
- **10 variantes de tema** (5 claras + 5 escuras) exercitadas, com **10 conjuntos distintos de tokens**, todos definidos — nenhum token crítico vazio.

## 5. DOM ↔ CSS (cobertura por tela)

Amostragem ampliada: **11/11 views** (`dash`, `dashboard`, `goals`, `caixa`, `bills`, `receivables`, `invest`, `pockets`, `cards`, `inicio`, `profile`) e **78/78 nós** com regras CSS casadas. Cada view contribuiu com 2–8 elementos representativos (containers, grids, cards e resumos), com estilos computados e regras correspondentes registrados.

A primeira passada (9 seletores do shell/Início) permanece em `tmp-c13/c1-auditoria-css.json`; a cobertura completa está em `tmp-c13/c1-ampliacao.json`.

## 6. Conflitos/sobrescritas identificados

1. `--action-border` redefinido em `features.css:3838,3842` (carrega depois de `themes.css:86,213`).
2. `@media (min-width:1024px)` duplicado em `dashboard-chat.css:965,986`.
3. `.export-preview-*` redefinido em `features.css:904/910` e `:933/940`.
4. `.bill-form-sheet` @700 redefinido em `features.css:3204,3286`.
5. `.card-form-sheet` @700 redefinido em `features.css:6124,6196`.
6. `.toolbar` @600: `components.css:865` vs. `#panelExportFormat .toolbar` em `features.css:3710` (ID vence).
7. `.log-toolbar` @600: `features.css:870` (`display:none`) e `:876` (reafirma colunas).
8. **Integridade:** `dashboard-chat.css:972-973` tem `*/` órfão (19 fechamentos para 18 aberturas de comentário).

**Achado documental:** `themes.css:4-7` descreve corretamente a ordem das seis folhas `style/*.css`, mas "primeiro entre as folhas locais" ignora `vendor/` e o Google Fonts externo; `themes.css:19` ainda cita `app.js`, que não existe.

## 7. Veredito por critério

| Critério | Estado |
|---|---|
| Existe documentação das variáveis desta branch | PASS |
| Inventário documentado confere com o código | PASS |
| Ordem real de carregamento | PASS |
| Coleta de estilos computados e temas | PASS |
| Responsividade medida (1→3 colunas) | PASS |
| Amostragem DOM↔CSS | PASS (amostra) |
| Cobertura de seletores por tela | PASS (11/11 views, 78/78 nós) |
| Inventário de breakpoints | PASS (15/15 condições de largura; 42 larguras varridas; 0 overflow) |
| Identificação de conflitos/sobrescritas | PASS |
| Fidelidade visual de CDNs externos | NOT RUN (bloqueados por metodologia — limitação, não critério de aceite) |
| Alterações em CSS/HTML/JS | PASS (nenhuma) |

**Veredito geral C.1: PASS.** Todos os critérios de aceite da fase foram evidenciados no HEAD `95b92c6`: ordem real de carregamento, inventário de tokens, cobertura DOM↔CSS por tela, estilos computados, breakpoints, conflitos/sobrescritas e verificação em navegador. A ausência de CDN/Firebase reais é uma limitação metodológica registrada, não uma falha de critério.

## 8. Evidências e limitações

- Dados brutos: `tmp-c13/c1-auditoria-css.json` (primeira passada) e `tmp-c13/c1-ampliacao.json` (cobertura integral).
- Scripts: `tmp-c13/c1-auditoria-css.cjs` e `tmp-c13/c1-ampliacao.cjs`; logs: `tmp-c13/c1-*.log`.
- 13 requisições externas bloqueadas; stub mínimo do Firebase; 0 erros de console e 0 exceções; portas `:8000`/`:9222` fechadas ao final.
- C.1 não aprova C.2–C.8; nenhuma migração global de CSS foi iniciada.
- Os arquivos de evidência C.1 permanecem não rastreados; sem commit/push nesta fase.
