# AuthOverlay — Evolução Visual

> **Histórico 03/11/2026 — entrega pontual.** Números de linha e tokens citados tratam do código na data da entrega; conferir o código atual (AGENTS.md §2/§45).

Data: 2026-11-03

## Resumo

Esta entrega consolida a evolução visual do AuthOverlay e duas alterações funcionais anteriores que permaneciam na working tree:

1. Ícone grande de livro aberto no lugar do texto “LIVRO-CAIXA”.
2. Botão “Esqueci minha senha” ligado ao fluxo real de recuperação de senha.
3. Navegação interna do botão/gesto Voltar.
4. FAB da aba Livro-Caixa corrigido.
5. Grupo de investimentos por instituição limitado a 1 ativo por padrão.
6. AuthOverlay reestruturado como Surface real.

## Hierarquia visual aplicada

```text
BACKGROUND
├── atmosfera imersiva (gradiente + var(--paper))
└── SURFACE (.auth-box)
    ├── marca (SVG livro)
    ├── título
    └── ELEVATED SURFACE
        ├── campo de e-mail
        ├── campo de senha
        ├── botão principal
        └── botão Google
```

## Alterações visuais

### `.auth-box`

- Transformado em Surface real:
  - `background: var(--surface)`
  - `border: 1px solid var(--line)`
  - `border-radius: 24px`
  - `padding: 32px`
  - `max-width: 420px`
  - `box-shadow: 0 18px 42px var(--shadow-color)`

> **Correção documental (12/11/2026):** a observação original estava incorreta. `--shadow-lg` existe no Design System (`style/themes.css`: `0 18px 42px var(--shadow-color)`) e é o token usado atualmente por `.auth-box` (`style/components.css`: `box-shadow: var(--shadow-lg)`). O valor literal `0 18px 42px var(--shadow-color)` foi posteriormente tokenizado como `var(--shadow-lg)`. O registro original é preservado abaixo apenas para rastreabilidade histórica.
>
> ~~Observação: `--shadow-lg` não existe no Design System; foi usado `--shadow-color`.~~

### Campos e botão Google

Campos e botão Google agora usam Elevated Surface:

- `background: var(--surface-raised)`
- `border: 1px solid var(--line)`
- `border-radius: 12px`
- `min-height: 48px`

Regras conflitantes de `min-height` foram consolidadas em 48px.

### Foco dos campos

- `.auth-box input:focus` troca apenas a cor da borda para `var(--accent)`.
- `.auth-box input:focus-visible` aplica:
  - `outline: 2px solid var(--accent)`
  - `outline-offset: 2px`
- O indicador permanece visível por teclado.
- A declaração fica após as regras temáticas, corrigindo a cascata anterior.

### Safe area

`style/components.css` passou a consolidar o espaçamento:

```css
#authOverlay {
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  padding-right: max(24px, env(safe-area-inset-right, 0px));
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  padding-left: max(24px, env(safe-area-inset-left, 0px));
}
```

A sobrescrita antiga de `features.css` foi removida.

### Placeholder/elevação/tema

- Campos usam `var(--surface-raised)` para distinguir da Surface principal.
- `.auth-box` usa `var(--surface)`, `var(--line)` e `var(--shadow-color)`.
- Regras duplicadas de background transparente de `.auth-box` no claro e escuro foram removidas.

### Acessibilidade de movimento

- Novo `@media (prefers-reduced-motion: reduce)` desativa a animação do indicador de diagnóstico em:
  - `#authDiagnosticToggle::after`
  - `#authDiagnosticToggle > span`

## Limpeza e cascata

Removidos por estarem obsoletos ou duplicados:

- `.auth-box label`
- `.auth-box-brand .fi`
- `.email-wrap input, .pass-wrap input { min-height: 44px }`
- Regras de tema que sobrescreviam o foco/background de campos e botão Google.

## Alterações funcionais incluídas nesta entrega

### Recuperação de senha

“Esqueci minha senha” agora usa `auth.sendPasswordResetEmail(email)`:

- pede e-mail se vazio;
- envia e-mail com link de recuperação;
- mostra mensagem de sucesso/erro.

### Navegação interna do Voltar

Implementação no `js/99-init.js`:

1. fecha modais/painéis abertos primeiro;
2. sem modal aberto, volta para a aba `Caixa`;
3. na raiz, deixa o sistema tratar a saída.

### FAB da aba Livro-Caixa

`openNewEntryModal()` foi implementada; o FAB agora abre o painel de novo lançamento.

### Investimentos por instituição

Grupos por instituição mostram **1 ativo por padrão**; o restante fica atrás do “Ver investimentos”.

## Validações executadas

- `git diff` revisado.
- Contagem de chaves/blocos CSS:
  - `components.css`: 274 `{` / 274 `}`
  - `features.css`: 1711 `{` / 1711 `}`
- Mobile 390x844 verificado nos 5 temas claros e 5 escuros.
- Viewport reduzida 320x480: overlay rola verticalmente, conteúdo não fica cortado.
- Focus visível verificado no tema claro e escuro:
  - borda e outline usam `var(--accent)`.
- `node --check js/18-render-core.js`: OK.
- `node --check js/99-init.js`: OK.

## Não executado

- Login real com Firebase em aparelho físico.
- Autofill/gestão de senhas em Android.
- Suíte E2E completa.
- Validação completa em dispositivo físico para safe areas de iOS/Android.
