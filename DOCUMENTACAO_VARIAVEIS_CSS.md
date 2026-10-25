# LIVRO-CAIXA — Referência de Variáveis CSS e Links

Este documento lista as variáveis CSS (`--*`) com seus valores padrão no `:root` e demais variáveis definidas fora dele. Útil para criar novos temas ou ajustar cores como `--line`, `--paper`, etc.

## Variáveis globais (`:root`)

| Variável | Valor padrão | Descrição |
|----------|-------------|-----------|
| `--font-ui` | `'Plus Jakarta Sans',sans-serif` | Fonte principal do app |
| `--paper` | `#F8F7F2` | Fundo secundário (cards, inputs) |
| `--paper-2` | `#F0F0EA` | Fundo terciário suave |
| `--ink` | `#19352A` | Texto principal / cor escura |
| `--ink-soft` | `#66746B` | Texto secundário / suave |
| `--green` | `#327957` | Verde principal (sucesso, positivo) |
| `--green-soft` | `#E7EFE8` | Verde suave (fundo de sucesso) |
| `--red` | `#B3432B` | Vermelho (erro, negativo, excedido) |
| `--red-soft` | `#F3E2DC` | Vermelho suave |
| `--line` | `#E1E1D9` | **Contorno / bordas / divisórias** (muito usado) |
| `--gold` | `#B89034` | Dourado (destaque, alerta) |
| `--gold-rgb` | `184,144,52` | Dourado em RGB para `color-mix` |
| `--gold-soft` | `#F2E8D0` | Dourado suave |
| `--on-accent` | `#FFFFFF` | Texto sobre cor de destaque |
| `--overlay` | `rgba(0,0,0,0.65)` | Overlay escuro (modais) |
| `--shadow` | `rgba(20,48,36,.08)` | Sombra suave |
| `--hover-soft` | `rgba(0,0,0,0.03)` | Hover sutil |
| `--surface` | `#FFFEFA` | Superfície principal (cards elevados) |
| `--surface-raised` | `#FCFDF9` | Superfície elevada |
| `--surface-accent` | `#18382C` | Superfície com tom de accent |
| `--accent` | `#327957` | **Cor primária / destaque principal** |
| `--accent-rgb` | `50,121,87` | Accent em RGB para `color-mix` |
| `--accent-to` | `#3A8A62` | Accent secundário (gradiente) |
| `--accent-ink` | `#FFFEF9` | Texto sobre accent |
| `--accent-muted` | `#E8F2EB` | Accent muito suave (fundo) |
| `--header-from` | `#153429` | Gradiente header — início |
| `--header-to` | `#1D3B30` | Gradiente header — fim |
| `--header-ink` | `#F9F8F3` | Texto do header |
| `--header-control-bg` | `rgba(9,30,21,.42)` | Fundo de controles no header |
| `--action-border` | `#C9D9CC` | Borda de ações / inputs |
| `--radius-sm` | `11px` | Raio pequeno |
| `--radius-md` | `14px` | Raio médio |
| `--radius-lg` | `15px` | Raio grande |
| `--radius-xl` | `18px` | Raio extra grande |
| `--radius-pill` | `999px` | Raio pílula / totalmente arredondado |
| `--dash-flow-income` | `#3E9B6E` | Cor fixa: fluxo de entrada (dashboard) |
| `--dash-flow-expense` | `#C2553B` | Cor fixa: fluxo de saída (dashboard) |
| `--dash-flow-patrimony` | `#B08D3E` | Cor fixa: patrimônio (dashboard) |

## Variáveis definidas fora do `:root`

| Variável | Valor | Arquivo | Descrição |
|----------|-------|---------|-----------|
| `--v1616-ease` | `cubic-bezier(.23,1,.32,1)` | `style/features.css:601` | Curva de easing das transições (botões, cards, navegação) |
| `--v1616-fast` | `180ms` | `style/features.css:601` | Duração base das microtransições |
| `--nav-indicator-x` | `0%` (base) | `style/features.css:672` | Posição X do indicador da bottom nav (`translateX`) |
| `--swatch` | por tema | `style/themes.css` | Cor do swatch de cada opção de tema no seletor |

## Como alterar `var(--line)` globalmente

No arquivo `style/themes.css`, linha 35:

```css
--line:#E1E1D9;
```

Altere o valor hexadecimal para a cor desejada. Isso afeta **todos os temas** que não sobrescreverem `--line` individualmente.

## Como criar um novo tema (ex: ID 6)

1. No `style/themes.css`, adicione os blocos:

```css
/* Modo claro — tema 6 */
body:not(.dark-mode)[data-light-theme="6"] {
  --line: #SUA_COR;
  --paper: #SUA_COR;
  --ink: #SUA_COR;
  --accent: #SUA_COR;
  /* ... todas as variáveis que quiser sobrescrever */
}

/* Modo escuro — tema 6 */
body.dark-mode[data-dark-theme="6"] {
  --line: #SUA_COR;
  --paper: #SUA_COR;
  --ink: #SUA_COR;
  --accent: #SUA_COR;
  /* ... */
}
```

2. Adicione os swatches:

```css
.light-theme-option[data-theme="6"]{--swatch:#SUA_COR;}
.dark-theme-option[data-theme="6"]{--swatch:#SUA_COR;}
```

3. No `index.html`, adicione botões dentro de `#lightThemePicker` e `#darkThemePicker` com `data-theme="6"`.

4. (Opcional) No `js/99-init.js`, adicione entrada em `LIGHT_THEME_COLORS` / `DARK_THEME_COLORS` para a cor do `<meta name="theme-color">`.

## IDs de tema já usados

- **Claro**: 1=Oliva, 2=Verde, 3=Lima, 4=Terracota, 5=Laranja
- **Escuro**: 1=Oliva, 2=Verde, 3=Bege, 4=Terracota, 5=Laranja
- **Livre**: 6 em diante

## Arquivos de estilo

- `style/themes.css` — definição de variáveis e paletas de tema
- `style/base.css` — estilos base (balances-hidden, etc.)
- `style/components.css` — componentes (período, botões, modais, toolbar, gráficos de categoria)
- `style/layout.css` — layout mobile, perfil, bottom-nav, pickers
- `style/features.css` — funcionalidades (conciliação, orçamento, diagnóstico, etc.)
- `style/dashboard-chat.css` — dashboard e chat IA
