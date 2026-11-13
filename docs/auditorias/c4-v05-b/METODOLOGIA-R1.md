# METODOLOGIA-R1 — Auditoria runtime de consumidores de `--accent`

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Método de coleta](#2-método-de-coleta)
  - [2.1 Harness e execução](#21-harness-e-execução)
  - [2.2 Identificação dos elementos consumidores de `--accent`](#22-identificação-dos-elementos-consumidores-de--accent)
  - [2.3 Coleta de foreground, background e fundo efetivo](#23-coleta-de-foreground-background-e-fundo-efetivo)
  - [2.4 Tratamento de transparências e gradientes](#24-tratamento-de-transparências-e-gradientes)
  - [2.5 Pseudo-elementos](#25-pseudo-elementos)
  - [2.6 SVG, `fill`, `stroke` e `currentColor`](#26-svg-fill-stroke-e-currentcolor)
  - [2.7 Seletores e declarações vencedoras](#27-seletores-e-declarações-vencedoras)
  - [2.8 Estados normal, hover, focus-visible, ativo e disabled](#28-estados-normal-hover-focus-visible-ativo-e-disabled)
  - [2.9 Elementos ocultos e elementos sem fundo próprio](#29-elementos-ocultos-e-elementos-sem-fundo-próprio)
  - [2.10 Cálculo da razão de contraste](#210-cálculo-da-razao-de-contraste)
  - [2.11 Classificação WCAG](#211-classificação-wcag)
- [3. Critérios de classificação (resumo)](#3-critérios-de-classificação-resumo)
- [4. Limitações da metodologia R1](#4-limitações-da-metodologia-r1)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da auditoria | C.4-V05-B-R1 (auditoria runtime de contraste de `--accent` em superfícies claras) |
| Natureza | Somente leitura / documentação e preservação de evidências. Nenhuma correção visual. |
| Data e horário de início | 2026-11-13T11:40:10.032Z (campo `meta.startedAt` do JSON) |
| Data e horário de término | 2026-11-13T11:44:52.771Z (campo `meta.finishedAt` do JSON) |
| Fuso horário | Execução no Termux/Android; os timestamps do artefato estão em UTC. Fuso local não registrado nos artefatos. |
| Branch do repositório | `feat/app-navigation-redesign` (verificado via `git branch --show-current` no momento da preservação) |
| Commit analisado | **Não registrado nos artefatos** (o JSON `meta` não contém campo `commit` nem `sha`). Não foi possível confirmar o SHA exato do HEAD no momento da coleta R1 a partir dos arquivos de evidência. |
| Versão do navegador | **Não registrada nos artefatos**. Conhecida do ambiente: Chromium 156 (conforme registro prévio de ambiente). Não consta em `meta` nem nos logs. |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222. Harness: `c4-v05-b-r1.cjs`. |
| Servidor local da aplicação | `python3 -m http.server 8000`, servindo `http://127.0.0.1:8000/index.html` |
| Viewports utilizados | Mobile: 390×844, `deviceScaleFactor: 1`, `mobile: true`. Desktop: 1440×900, `deviceScaleFactor: 1`, `mobile: false`. |
| Temas examinados (claros — alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja (aplicados via `window.applyLightTheme(id, false)`) |
| Temas examinados (escuros — controle de regressão) | 1 Escuro Oliva, 2 Verde escuro (registro: "Escuro Verde"), 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja (aplicados via `window.applyDarkTheme(id, false)` + `document.body.classList.add('dark-mode')`) |
| Hash do JSON bruto | `3f795f6014732465` (campo `meta.hash`; SHA-256 truncado a 16 hex) |
| SHA-256 completo do arquivo JSON preservado | `9d9cdcf05468364c8936a62f50d2dcdd3ffdfe6ed20c19c1997f456b3318afe8` |

## 2. Método de coleta

### 2.1 Harness e execução

O harness `c4-v05-b-r1.cjs` executa em Node.js, conecta ao CDP na porta 9222, habilita os domínios `Page`, `Runtime`, `DOM`, `CSS`, `Emulation`, navega para `http://127.0.0.1:8000/index.html`, aguarda o estado de prontidão da aplicação (`document.readyState === 'complete'`, existência de `applyLightTheme` e do elemento `#viewDash`), injeta um `<style id="c4-audit-style">` que oculta `#authOverlay`/`#syncOverlay` e desativa transições/animações, e então itera sobre combinações de viewport × tema × tela/painel.

Ao final, remove os marcadores temporários `data-c4-audit`/`data-c4-state`, remove o estilo injetado, remove `dark-mode`, reaplica o tema claro 1 (Oliva) e grava o resultado JSON em `/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1.json` e o log de execução em `.log` e `.run.log`.

### 2.2 Identificação dos elementos consumidores de `--accent`

A coleta de elementos é feita pelo script `collectScript` injetado via `Runtime.evaluate`:

1. Obtém o valor computado de `--accent` em `document.body` (`getComputedStyle(document.body).getPropertyValue('--accent').trim()`), chamado `accentRaw`.
2. Executa `document.querySelectorAll(KEY_SELECTORS.join(','))` sobre os 46 seletores constantes em `KEY_SELECTORS` (linhas 28-43 do harness), adicionando ao conjunto `known` os elementos visíveis.
3. Executa `document.querySelectorAll('body *')` sobre todos os elementos do corpo. Para cada elemento visível (exceto `body` e `documentElement`), obtém `getComputedStyle(el)` e os pseudo-elementos `::before`/`::after` via `getComputedStyle(el,'::before')` e `getComputadoStyle(el,'::after')`.
4. Um elemento é considerado "consumidor de `--accent`" (hit) quando há correspondência exata (`exact`) de `accentRaw` em qualquer um destes:
   - `color` do elemento
   - `backgroundColor` do elemento
   - `borderTopColor` (quando `borderTopWidth > 0` e `borderTopStyle !== 'none'`)
   - `outlineColor` (quando `outlineWidth > 0` e `outlineStyle !== 'none'`)
   - `color` de `::before` ou `::after` (quando `content` não é `none`/`normal`)
   - `backgroundColor` de `::before` ou `::after` (quando `content` não é `none`/`normal` e largura > 0)

A correspondência exata compara canais RGBA com tolerância de 0.5 nos canais RGB e 0.01 no alfa, após parsing de `rgba()`, `color(srgb ...)` e `#RRGGBB[AA]`.

Elementos com hit recebem o atributo temporário `data-c4-audit` com chave `c4-N` e constituem as amostras das `rows`.

### 2.3 Coleta de foreground, background e fundo efetivo

Para cada amostra, o harness captura:

- `color`, `backgroundColor`, `backgroundImage`, `fontSize`, `fontWeight` (computed style do elemento)
- `borderTopWidth/Style/Color`, `outlineWidth/Style/Color`
- `::before`/`::after`: `color`, `backgroundColor`, `content`, `width`, `height`
- `rect` (bounding client rect), `role`, `aria-label`, `disabled`, `tabIndex`

**Fundo efetivo do próprio elemento (`bgRgb`):** função `effBg(el, false)`. Percorre a cadeia de ancestrais do elemento até a raiz (inclusive o próprio elemento), do mais externo para o mais interno, compondo cada `backgroundColor` opaco sobre o acumulado, começando de branco (`{255,255,255,1}`). A composição usa alfa sobre fundo (`ccomp`): se a cor tem alfa < 1, ela é composta sobre o fundo atual.

**Fundo efetivo externo (`outsideRgb`):** função `effBg(el, true)`. Idêntica, mas inicia a cadeia no `parentElement` do elemento. Serve de referência para contraste de superfície (fundo do componente sobre o fundo da página) e de borda/outline/pseudo-fundo.

**Incerteza e gradientes:** se qualquer ancestral (ou o próprio elemento) tem `backgroundImage !== 'none'`, o ancestral é adicionado à lista `uncertain` e as cores `rgba()`/`color(srgb...)` encontradas na imagem de fundo são capturadas em `gradientColors`. Quando há gradientes, `textRatio` é calculado como o mínimo entre o texto sobre o fundo composto e o texto sobre cada cor do gradiente composta sobre branco (abordagem conservadora).

### 2.4 Tratamento de transparências e gradientes

- Cores com alfa < 1 são compostas sobre o fundo efetivo antes do cálculo da razão (`compFg = comp(fg, bg)` quando `fg.a < 1`).
- Gradientes são capturados apenas pelas cores `rgba()`/`color(srgb...)` presentes na string `backgroundImage`. Não há reconstrução de paradas de gradiente, ângulo, repetição ou máscara. Quando há gradiente, o resultado é marcado com ancestral(es) em `uncertain`.
- `transparent` é tratado como `{r:0,g:0,b:0,a:0}`.

### 2.5 Pseudo-elementos

- `::before` e `::after` são inspecionados via `getComputedStyle(el,'::before')` / `getComputadoStyle(el,'::after')`.
- Se `content` não é `none`/`normal`, a cor do pseudo-elemento (`pBeforeColor`/`pAfterColor`) é considerada para o ícone (`iconRatio`) sobre o fundo do elemento.
- Se o pseudo-elemento tem `backgroundColor` opaco e largura > 0, `pseudoBgRatio` mede o contraste dessa cor sobre o fundo externo (`outsideRgb`).
- Não há tratamento específico de `::marker`, `::first-line`, `::first-letter` ou outros pseudo-elementos.

### 2.6 SVG, `fill`, `stroke` e `currentColor`

**Não tratados pelo harness R1.** O `collectScript` não inspeciona atributos `fill`, `stroke`, `stop-color`, nem resolve `currentColor` em elementos SVG. Ícones `.fi` (Tabler/Flaticon via pseudo-elemento `::before`) são capturados apenas como cor de texto/background do pseudo-elemento sobre o fundo do pai. Qualquer contraste baseado em preenchimento/traço de SVG está fora do escopo da mensuração R1.

### 2.7 Seletores e declarações vencedoras

**Não capturados pelo R1.** O harness utiliza apenas `getComputedStyle` (estilo computado final). Não chama `CSS.getMatchedStylesForNode` nem registra a regra CSS vencedora, seletor, arquivo ou linha de origem. Isso significa que não é possível rastrear, a partir do JSON R1, qual declaração em `style/*.css` produziu cada valor. (Essa abordagem foi introduzida apenas em execuções posteriores R2/R3, não em R1.)

### 2.8 Estados normal, hover, focus-visible, ativo e disabled

Sondas por CDP `CSS.forcePseudoState` sobre 10 seletores prioritários:

```
.toolbar button.primary
.toolbar button:not(.primary)
.ledger-filter-button
.mobile-bottom-nav button
.drawer-nav button
.dash-expand-btn
.invest-total-expand-btn
.profile-avatar
.credit-card-invoice-toggle
.credit-card-invoice-reset
```

Condições:
- Viewports: mobile 390×844 e desktop 1440×900.
- Temas: somente claros 3 (Lima), 4 (Terracota), 5 (Laranja).
- Abas: `dash` (Dashboard), `caixa` (Lançamentos), `invest` (Investimentos), `profile` (Perfil).
- Estados: `normal`, `hover`, `focus-visible`, `active`, `disabled`. Para estados diferentes de `normal`, aplica `CSS.forcePseudoState` com a pseudoclasse, lê `getComputedStyle`, e remove a pseudoclasse depois.
- Cada estado captura `color`, `backgroundColor`, `backgroundImage`, `border`, `outline`, `filter`, `opacity`, `rect`.
- Total de linhas de estado: 960.

Limitação: o estado `disabled` é forçado via pseudoclasse CSS e pode não refletir o comportamento real de interação (ativo/inativo da aplicação).

### 2.9 Elementos ocultos e elementos sem fundo próprio

- Elementos são filtrados pela função `visible(el)`: descarta se `display === 'none'`, `visibility === 'hidden'`, `opacity === 0`, ou retângulo com largura/altura <= 0.
- Elementos sem `backgroundColor` opaco próprios herdam o fundo composto da cadeia de ancestrais (`effBg`), começando de branco. Elementos sem fundo definido não são excluídos; seu fundo efetivo é o da página/ancestrais mais próximo.

### 2.10 Cálculo da razão de contraste

Implementado em Node (funções `parseColor`, `comp`, `lum`, `ratio`):

- Luminância relativa sRGB: linearização de cada canal (`x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)^2.4`), depois `L = 0.2126·R + 0.7152·G + 0.0722·B`.
- Razão WCAG: `(Lmax + 0.05) / (Lmin + 0.05)`, usando as luminâncias do foreground e background compostos.

Razões calculadas por amostra:
- `textRatio`: foreground de texto sobre `bgRgb` (fundo efetivo do elemento). Se há gradientes, mínimo sobre cada cor do gradiente composta sobre branco.
- `bgRatio`: fundo do componente (`bg`) sobre o fundo externo (`outsideRgb`) — contraste de superfície.
- `borderRatio`: cor da borda sobre `bgRgb`.
- `outlineRatio`: cor do outline sobre `bgRgb`.
- `iconRatio`: cor do pseudo-elemento (ícone) sobre `bgRgb`.
- `pseudoBgRatio`: fundo do pseudo-elemento sobre `outsideRgb`.

### 2.11 Classificação WCAG

| Classe | Limiar | Aplica-se |
| --- | --- | --- |
| Texto normal | 4,5:1 | `fontSize < 24px` OU (`fontSize < 18,66px` E `fontWeight < 700`) |
| Texto grande | 3:1 | `fontSize >= 24px` OU (`fontSize >= 18,66px` E `fontWeight >= 700`) |
| Componente gráfico / superfície | 3:1 | fundo de botão, pill, toggle, ícone funcional |
| Foco / borda / outline | 3:1 | WCAG 1.4.11 |

Regras de decisão:
- Se o elemento tem texto (`hasText`: texto não vazio e tag em `button,a,label,small,span,strong,p,h1..h6` ou `directText`), usa `textRatio` com o limiar de texto normal ou grande conforme `large`.
- Se o elemento é ícone (`icon`: sem texto e tag `i/svg/img` ou pseudo-elemento com conteúdo), usa `iconRatio` com limiar 3:1.
- Se há `bgRatio` (fundo opaco), usa limiar 3:1 para superfície.
- Sem arredondamento para aprovação (comparação estrita com tolerância de 1e-9).

Categorias de resultado:
- **APROVADO**: todas as razões aplicáveis atendem ao limiar.
- **FALHA**: pelo menos uma razão aplicável está abaixo do limiar.
- **INCONCLUSIVO**: fundo com gradiente/não compósito ou composição incerta (`uncertain` não vazio) — não conta como aprovação nem falha definitiva.
- **N.A.**: nenhuma razão aplicável (ex.: elemento sem texto, sem ícone, sem fundo opaco).
- **NÃO MEDIDO**: não se aplica neste conjunto (todas as amostras foram medidas).

## 3. Critérios de classificação (resumo)

- Texto normal: mínimo 4,5:1, sem arredondamento.
- Texto grande: mínimo 3:1, somente quando enquadrado na definição WCAG (tamanho e peso).
- Componentes gráficos funcionais: mínimo 3:1, quando aplicável.
- Indicadores de foco: 3:1, considerando cores adjacentes e geometria do indicador.

Não tratar 75 seletores distintos como "75 falhas confirmadas" automaticamente: cada amostra individual tem seu próprio resultado; a agregação por seletor é apenas para leitura.

## 4. Limitações da metodologia R1

1. Não há registro do commit/branch analisado nos artefatos (não há campo `commit`/`sha` em `meta`).
2. Não há registro da versão do navegador nos artefatos.
3. Não há captura de seletor/declaração CSS vencedora (apenas `getComputedStyle`).
4. Não há tratamento de SVG `fill`/`stroke`/`currentColor`.
5. Gradientes são tratados de forma conservadora (sobre branco) e marcados como incertos quando há `backgroundImage` na cadeia.
6. Estados `disabled` forçados via CDP podem não refletir a interação real.
7. Não há screenshots nem validação visual por dispositivo físico.
8. Temas escuros usados apenas como controle de regressão; não são alvo de correção.
