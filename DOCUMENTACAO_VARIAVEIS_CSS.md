# LIVRO-CAIXA — Referência de Variáveis CSS e Temas

Este documento descreve **os tokens CSS efetivamente existentes** após a padronização da nomenclatura. Ele cobre:

- convenção de nomes;
- inventário com nome, finalidade, origem e escopo;
- as cinco variantes claras e as cinco escuras;
- aliases removidos/mantidos;
- regras para criar novos tokens;
- exemplos atualizados de criação de temas.

A referência é o CSS do repositório local. Se este documento e o código divergirem, **o código atual prevalece**.

## 1. Convenção de nomenclatura

### 1.1 Identidade visual

Tokens que definem a aparência do produto, independentemente de estado:

- `--color-*` — cor-base da identidade (Verde/Vermelho/Dourado e suas versões `-subtle`).
- `--accent`, `--accent-to`, `--accent-rgb` — cor principal e escala de gradiente/mistura.
- `--header-*` — chrome do cabeçalho.

Regra: tokens de identidade **não** devem ser usados como status semântico.

### 1.2 Tokens semânticos

Descrevem significado, não cor fixa:

- `--success`, `--danger`, `--warning`, `--info`;
- `--success-subtle`, `--danger-subtle`, `--warning-subtle`, `--info-subtle` — fundos suaves;
- `--success-foreground`, `--danger-foreground`, `--warning-foreground`, `--info-foreground` — texto/ícone sobre fundo sólido ou contraste forte;
- `--accent-foreground` — texto apropriado à identidade accent;
- `--on-solid` — texto sobre qualquer fundo sólido (accent, success, danger, warning ou ações coloridas).

### 1.3 Tokens de superfície

- `--paper`, `--paper-2` — fundos de página/seções;
- `--surface`, `--surface-raised` — superfícies principais/elevadas;
- `--surface-accent` — superfície com tom de accent;
- `--line` — contorno/divisória;
- `--ink`, `--ink-soft` — texto principal/secundário;
- `--hover-soft` — camada neutra de hover/seleção.

### 1.4 Tipografia

- `--font-family-ui` — família tipográfica principal;
- `--font-size-*` — escala tipográfica;
- `--font-weight-*` — pesos;
- `--line-height-*` — espaçamento vertical.

### 1.5 Geometria, foco e sombras

- `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-pill`;
- `--shadow-color` — **cor** usada pelas sombras, não a geometria;
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-overlay` — geometria/intensidade. `--shadow-color` descreve só a tinta;
- `--overlay-color` — fundo de camadas modais;
- `--z-modal`, `--z-fab` — níveis de camadas.

### 1.6 Tokens de ação/componentes

Formato:

```css
--action-{nome}-{propriedade}
```

Sufixos aprovados:

- `-foreground` — texto/ícone;
- `-background` — fundo sólido;
- `-background-subtle` — fundo suave;
- `-background-hover` — fundo sólido em hover;
- `-border` — borda;
- `-border-hover` — borda em hover/foco.

Ações existentes:

- `finalize` / `unarchive` — finalizar e arquivar/desarquivar;
- `delete` — ação destrutiva;
- `yield` — rendimento;
- `accent` — ação com a cor de accent.

Regra crítica: **cada ação foi separada por propriedade**, não por um único token genérico.

`--action-border` genérico foi preservado e é a borda padrão de ações não específicas.

### 1.7 Variáveis dinâmicas de execução

São setadas pelo JavaScript/contexto e **não** são tokens globais:

- `--theme-swatch` — cor do botão de tema no seletor;
- `--category-color` — cor de categoria vinda dos dados;
- `--dash-pill-i` — índice do donut do dashboard;
- `--nav-indicator-x` — posição do indicador da bottom nav;
- `--pill-left`, `--pill-width`, `--pill-height` — métricas medidas em runtime;
- `--v1616-ease`, `--v1616-fast` — constantes locais de transição;
- `--toggle-active-bg`, `--toggle-active-border`, `--toggle-active-foreground` — controle ativo, definido por tema/body.

Não criar variáveis roll-out globais para estados transitórios.

---

## 2. Inventário completo (pós-migração)

"Root" = valor neutro inicial em `:root`. "Body" = definido em `body` para resolver `var(--accent)` com o valor cascata do tema. "Tema" = sobrescrito por um bloco de tema.

### 2.1 Tipografia

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--font-family-ui` | `'Plus Jakarta Sans',sans-serif` | `:root`, `style/themes.css` | Família principal |
| `--font-size-caption` | `10px` | `:root` | legendas |
| `--font-size-small` | `12px` | `:root` | texto secundário |
| `--font-size-body` | `13px` | `:root` | texto base |
| `--font-size-title` | `18px` | `:root` | títulos |
| `--font-size-heading` | `27px` | `:root` | heading grande |
| `--font-weight-regular` | `400` | `:root` | regular |
| `--font-weight-medium` | `500` | `:root` | médio |
| `--font-weight-semibold` | `600` | `:root` | semibold |
| `--font-weight-bold` | `700` | `:root` | bold |
| `--line-height-tight` | `1.15` | `:root` | linha compacta |
| `--line-height-body` | `1.5` | `:root` | linha de corpo |

### 2.2 Superfície, papel e texto

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--paper` | Root `#F8F7F2`; tema sobrescreve | `:root` + temas/body.dark | Fundo de página |
| `--paper-2` | Root `#F0F0EA`; tema sobrescreve | `:root` + temas/body.dark | Fundo terciário |
| `--surface` | Root `#FFFEFA`; tema sobrescreve | `:root` + temas/body.dark | Superfície principal |
| `--surface-raised` | Root `#FCFDF9`; tema sobrescreve | `:root` + temas/body.dark | Superfície elevada |
| `--surface-accent` | Root `#18382C`; tema sobrescreve | `:root` + temas/body.dark | Superfície com accent |
| `--ink` | Root `#19352A`; tema sobrescreve | `:root` + temas/body.dark | Texto principal |
| `--ink-soft` | Root `#66746B`; tema sobrescreve | `:root` + temas/body.dark | Texto secundário |
| `--line` | Root `#E1E1D9`; tema sobrescreve | `:root` + temas/body.dark | Bordas/divisórias |
| `--hover-soft` | Root `rgba(0,0,0,0.03)`; tema sobrescreve | `:root` + temas/body.dark | Hover/seleção neutra |

### 2.3 Identidade visual

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--color-green` | Root `#327957`; tema sobrescreve | `:root` + temas | Cor verde-base |
| `--color-green-subtle` | Root `#E7EFE8`; tema sobrescreve | `:root` + temas | Verde suave |
| `--color-red` | Root `#B3432B`; tema sobrescreve | `:root` + temas | Vermelho-base |
| `--color-red-subtle` | Root `#F3E2DC`; tema sobrescreve | `:root` + temas | Vermelho suave |
| `--color-gold` | Root `#B89034`; tema sobrescreve | `:root` + temas | Dourado |
| `--color-gold-subtle` | Root `#F2E8D0`; tema sobrescreve | `:root` + temas | Dourado suave |
| `--gold-rgb` | Root `184,144,52`; tema sobrescreve | `:root` + temas | RGB dourado para `color-mix` |
| `--accent` | Root `#327957`; tema sobrescreve | `:root` + temas/body | Accent principal |
| `--accent-rgb` | Root `50,121,87`; tema sobrescreve | `:root` + temas/body.dark | RGB accent |
| `--accent-to` | Root `#3A8A62`; tema sobrescreve | `:root` + temas/body.dark | Accent secundário (gradiente) |
| `--accent-foreground` | Root `#FFFEF9`; tema sobrescreve | `:root` + temas/body.dark | Texto sobre accent |
| `--accent-subtle` | Root `#E8F2EB`; tema sobrescreve | `:root` + temas/body.dark | Fundo accent suave |

### 2.4 Estados semânticos

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--success` | Root `#1F6F45`; dark `#7AD3A3` | `:root` + body.dark | Sucesso/positivo |
| `--success-subtle` | Root `#E7F3EA`; dark `#183C2E` | `:root` + body.dark | Fundo de sucesso |
| `--success-foreground` | Root `#F5FBF6`; dark `#0E2018` | `:root` + body.dark | Texto sobre sucesso sólido |
| `--danger` | Root `#B3432B`; dark `#F0785E` | `:root` + body.dark | Erro/negativo/excedido |
| `--danger-subtle` | Root `#F7E8E4`; dark `#3B2420` | `:root` + body.dark | Fundo de perigo |
| `--danger-foreground` | Root `#F8F0EC`; dark `#1A0D0A` | `:root` + body.dark | Texto sobre perigo sólido |
| `--warning` | Root `#A65A17`; dark `#E4BC62` | `:root` + body.dark | Alerta/atenção |
| `--warning-subtle` | Root `#F8ECD9`; dark `#3A301B` | `:root` + body.dark | Fundo de alerta |
| `--warning-foreground` | Root `#1A1408` | `:root` + body.dark | Texto sobre alerta sólido |
| `--warning-rgb` | Root `166,90,23`; dark `228,188,98` | `:root` + body.dark | RGB warning |
| `--info` | Root `#246E8A`; dark `#80C9E0` | `:root` + body.dark | Informação neutra |
| `--info-subtle` | Root `#E5EEF3`; dark `#1D3240` | `:root` + body.dark | Fundo de informação |
| `--info-foreground` | Root `#EFF7FA`; dark `#0B1F2B` | `:root` + body.dark | Texto sobre info sólido |

### 2.5 Header

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--header-from` | Root `#153429`; tema sobrescreve | `:root` + temas | Início do gradiente |
| `--header-to` | Root `#1D3B30`; tema sobrescreve | `:root` + temas | Fim do gradiente |
| `--header-foreground` | Root `#F9F8F3`; tema sobrescreve | `:root` + temas | Texto do header |
| `--header-control-bg` | Root `rgba(9,30,21,.42)`; tema sobrescreve | `:root` + temas | Fundo de controle no header |

### 2.6 Ações e controles

| Token | Definição | Escopo | Uso |
|---|---|---|---|
| `--action-border` | Root `#C9D9CC`; dark usa `color-mix(accent 35%, var(--line))` | `:root` + body.dark | Borda padrão de ações |
| `--action-finalize-foreground` | `var(--color-green)` | body | Texto/ícone finalizar |
| `--action-finalize-background` | `color-mix(var(--color-green) 10%, var(--surface))` | body | Fundo sutil finalizar |
| `--action-finalize-background-hover` | `color-mix(var(--color-green) 24%, var(--surface))` | body | Fundo hover finalizar |
| `--action-finalize-border` | `color-mix(var(--color-green) 28%, var(--line))` | body | Borda finalizar |
| `--action-finalize-border-hover` | `color-mix(var(--color-green) 55%, var(--line))` | body | Borda hover finalizar |
| `--action-unarchive-foreground` | `var(--color-gold)` | body | Texto/ícone desarquivar |
| `--action-unarchive-background` | `color-mix(var(--color-gold) 10%, var(--surface))` | body | Fundo sutil desarquivar |
| `--action-unarchive-background-hover` | `color-mix(var(--color-gold) 24%, var(--surface))` | body | Fundo hover desarquivar |
| `--action-unarchive-border` | `color-mix(var(--color-gold) 28%, var(--line))` | body | Borda desarquivar |
| `--action-unarchive-border-hover` | `color-mix(var(--color-gold) 55%, var(--line))` | body | Borda hover desarquivar |
| `--action-delete-foreground` | `var(--color-red)` | body | Texto/ícone excluir |
| `--action-delete-background` | `var(--color-red)` | body | Fundo sólido excluir |
| `--action-delete-background-subtle` | `color-mix(var(--color-red) 10%, var(--surface))` | body | Fundo sutil excluir |
| `--action-delete-border` | `color-mix(var(--color-red) 28%, var(--line))` | body | Borda excluir |
| `--action-yield-background` | `var(--color-gold)` | body | Fundo rendimento |
| `--action-accent-foreground` | `var(--accent)` | body | Texto/ícone accent |
| `--action-accent-background` | `color-mix(var(--accent) 10%, var(--surface))` | body | Fundo sutil accent |
| `--action-accent-background-subtle` | `color-mix(var(--accent) 12%, transparent)` | body | Fundo extra-sutil accent |
| `--action-accent-border` | `color-mix(var(--accent) 28%, var(--line))` | body | Borda accent |
| `--control-hover-bg` | Root `var(--surface)`; dark `var(--surface-accent)` | body/body.dark | Fundo hover controle |
| `--control-hover-border` | Root `var(--line)`; dark `var(--accent)` | body/body.dark | Borda hover controle |
| `--control-hover-foreground` | Root `var(--ink)`; dark `var(--ink)` | body/body.dark | Texto hover controle |
| `--toggle-active-bg` | `var(--accent)` | body/body.dark | Fundo controle ativo |
| `--toggle-active-foreground` | Root `var(--accent-foreground)`; dark idem | body/body.dark | Texto ativo |
| `--toggle-active-border` | `var(--accent)` | body/body.dark | Borda ativa |

### 2.7 On-solid, overlay, shadow, swatch e foco

| Token | Valor | Escopo/origem | Uso |
|---|---|---|---|
| `--on-solid` | Root `#FFFFFF`; tema sobrescreve | `:root` + temas/body.dark | Texto sobre fundo sólido |
| `--overlay-color` | Root `rgba(0,0,0,0.65)`; tema sobrescreve | `:root` + temas | Overlay de modais |
| `--shadow-color` | Root `rgba(20,48,36,.08)`; tema sobrescreve | `:root` + temas/body.dark | Cor das sombras |
| `--shadow-sm` | `0 1px 3px var(--shadow-color)` | `:root` | Sombra pequena |
| `--shadow-md` | `0 4px 14px var(--shadow-color)` | `:root` | Sombra média |
| `--shadow-lg` | `0 18px 42px var(--shadow-color)` | `:root` | Sombra grande |
| `--shadow-overlay` | `0 -18px 50px rgba(0,0,0,.28)` | `:root` | Sombra de overlay |
| `--theme-swatch` | por opção de tema | `style/themes.css` / seletor | Cor do swatch |
| `--z-modal` | `1400` | `:root` | Camada modal |
| `--z-fab` | `1300` | `:root` | Camada FAB |

### 2.8 Gráficos e paleta fixa do dashboard

Não são sobrescritos pelos temas.

| Token | Valor | Uso |
|---|---|---|
| `--dash-flow-income` | `#3E9B6E` | Fluxo de entrada |
| `--dash-flow-expense` | `#C2553B` | Fluxo de saída |
| `--dash-flow-patrimony` | `#B08D3E` | Patrimônio |

### 2.9 Componentes e locais

| Token | Valor/função | Escopo | Uso |
|---|---|---|---|
| `--v1616-ease` | `cubic-bezier(.23,1,.32,1)` | `style/features.css` | Curva de transição |
| `--v1616-fast` | `180ms` | `style/features.css` | Duração base |
| `--radius-xs` | `8px` | `:root` | Raio pequeno |
| `--radius-sm` | `11px` | `:root` | Raio pequeno |
| `--radius-md` | `14px` | `:root` | Raio médio |
| `--radius-lg` | `15px` | `:root` | Raio grande |
| `--radius-xl` | `18px` | `:root` | Raio extra |
| `--radius-2xl` | `24px` | `:root` | Raio maior |
| `--radius-pill` | `999px` | `:root` | Pílula |

---

## 3. Temas

Os blocos de tema **sobrescrevem** o `:root` por cascata:

```css
body:not(.dark-mode)[data-light-theme="N"] { ... }
body.dark-mode[data-dark-theme="N"] { ... }
```

**O tema escuro (`data-dark-theme="3"`) é a paleta base em `body.dark-mode`** — o bloco escuro padrão define os tokens escuros e não precisa de seletor exclusivo. Os dark themes 1, 2, 4 e 5 têm blocos adicionais.

### 3.1 Claras

| ID | Nome | Estratégia |
|---|---|---|
| 1 | Oliva | chrome creme + oliva escuro no accent/header; `--accent:#5F7A43`, `--color-green:#437A4E`, `--color-gold:#B08D3E`, `--on-solid:#F7FAF6` |
| 2 | Verde | palette default do `:root` (`--accent:#327957`) |
| 3 | Lima | verde-lima; `--accent:#40916C`, `--color-gold/#color-red = #90A955`, `--line: color-mix(...)` |
| 4 | Terracota | terracota; `--accent:#C66F50`, `--header-from:#8F4F3C`, `--surface-raised:#FFFBF5` |
| 5 | Laranja | laranja; `--accent:#E85002`, `--header-from:#C10801` |

### 3.2 Escuras

| ID | Nome | Estratégia |
|---|---|---|
| 1 | Oliva | grafite-quente + oliva claro; `--accent:#9DD08B`, `--color-green:#8FC596`, `--header-from:#111709` |
| 2 | Verde | grafite + verde neon `#22C55E` |
| 3 | Bege | **base de `body.dark-mode`** (`--accent:#C9A86A`) |
| 4 | Terracota | grafite quente + `#D08860` |
| 5 | Laranja | preto + laranja; `--accent:#E85002`, `--header-to:#C10801` |

### 3.3 Regra de sobrescrita

Ordem efetiva:

1. `:root` fornece o neutro;
2. `body` define ações/controles resolvidos com `var(--accent)`/`var(--line)`;
3. `body.dark-mode` sobrescreve a base escura;
4. `[data-dark-theme="N"]`/`[data-light-theme="N"]` sobrescreve só os tokens daquela paleta.

Se um token **não** aparece no bloco de tema, ele herda do `body.dark-mode` ou `:root`.

---

## 4. Aliases e compatibilidade

### 4.1 Aliases removidos

Os seguintes aliases redundantes foram eliminados porque todos os consumidores foram migrados:

- `--accent-soft`/`--accent-muted` → unificados em `--accent-subtle`. Não há dupla definição.

### 4.2 Nomes preservados intencionalmente

São nomes estáveis e **não** devem ser renomeados agora:

- `--ink`, `--ink-soft`, `--hover-soft`;
- `--gold-rgb`, `--accent-rgb`, `--warning-rgb`;
- `--header-from`, `--header-to`;
- `--dash-flow-income`, `--dash-flow-expense`, `--dash-flow-patrimony`;
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-overlay`.

### 4.3 Aliases temporários

Nenhum alias temporário foi mantido. Se um consumidor externo surgir no futuro, preferir migrá-lo em vez de recriar compatibilidade.

---

## 5. Governança: criar tokens novos

1. Prefira nomes semânticos (`--success-*`, `--surface-*`, `--action-*`).
2. Não use `-ink` nem `-soft` em propriedades novas; use `-foreground` e `-subtle`.
3. Não confunda identidade visual com estado semântico.
4. Não duplique tokens com mesma finalidade; reutilize/renameie.
5. Valores de tema: sobrescreva no bloco de tema; não crie cópia alternativa.
6. Variáveis transitórias/componentes: usar nomes locais como `--nav-indicator-x`, não tokens globais de tema.
7. Sombra: usar `--shadow-color` para cor; não colocar geometria como "color".
8. Ação: separar por propriedade (`foreground`/`background`/`background-subtle`/`background-hover`/`border`/`border-hover`), salvo quando o componente realmente não usa.

---

## 6. Exemplos de criação de tema

### 6.1 Tema claro hipotético (ID 6)

```css
body:not(.dark-mode)[data-light-theme="6"] {
  --paper: #FAF9F6;
  --paper-2: #EEEEE5;
  --ink: #31572C;
  --ink-soft: #3D7A5C;
  --line: color-mix(in srgb, #90A955 35%, #FAF9F6);
  --surface: #FFFFFF;
  --surface-raised: #F3F6EF;
  --surface-accent: #31572C;
  --accent: #40916C;
  --accent-rgb: 64,145,108;
  --accent-to: #4EA77B;
  --accent-foreground: #FAF9F6;
  --accent-subtle: color-mix(in srgb, #ECF39E 55%, #FAF9F6);
  --color-green: #357A57;
  --color-green-subtle: #F2F6C6;
  --color-gold: #90A955;
  --gold-rgb: 144,169,85;
  --color-gold-subtle: #F2F6C6;
  --header-from: #31572C;
  --header-to: #40916C;
  --header-foreground: #FAF9F6;
  --header-control-bg: rgba(49,87,44,.32);
  --action-border: color-mix(in srgb, var(--accent) 35%, var(--line));
}
```

Seletor:

```css
.light-theme-option[data-theme="6"] { --theme-swatch: #40916C; }
```

E `index.html`/`js/99-init.js`, seguindo o padrão dos IDs 1–5.

### 6.2 Tema escuro hipotético (ID 6)

```css
body.dark-mode[data-dark-theme="6"] {
  --paper: #000000;
  --paper-2: #121212;
  --surface: #121212;
  --surface-raised: #1A1A1A;
  --surface-accent: #2A1208;
  --ink: #F9F9F9;
  --ink-soft: #A7A7A7;
  --accent: #E85002;
  --accent-rgb: 232,80,2;
  --accent-to: #F16001;
  --accent-foreground: #FFFFFF;
  --accent-subtle: #4A1C08;
  --header-from: #000000;
  --header-to: #C10801;
  --header-foreground: #F9F9F9;
  --on-solid: #FFFFFF;
  --shadow-color: rgba(0,0,0,.45);
}
```

Seletor:

```css
.dark-theme-option[data-theme="6"] { --theme-swatch: #E85002; }
```

---

## 7. Ordem de carregamento e escopo

1. `style/themes.css` primeiro (define `:root`, seletores de tema e ações).
2. Em seguida, `style/base.css`, `style/components.css`, `style/layout.css`, `style/features.css`, `style/dashboard-chat.css` conforme o HTML.

A ordem importa: `body` resolve `--accent` com o valor cascaded do tema/seletor, por isso as ações ficam em `body`, não em `:root`.
