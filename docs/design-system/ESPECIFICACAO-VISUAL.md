# Especificação Visual — Baseline do APP LAYOUT REDESIGN

**Classificação:** baseline visual e especificação proposta — **aguardando aceite independente**. Não é aprovação de redesign nem relatório de regressão.
**Baseline:** branch `feat/app-layout-redesign` · HEAD `cdbcb88354e74a3f1956e868905e9b67bfbd31e4` · coleta em 21/11/2026 com Chromium 156 headless (CDP :9222), servidor estático local em `http://127.0.0.1:8000`.
**Evidência:** `e2e/visual/c3/coleta-cdbcb88/manifest.json`, 110 PNGs em `e2e/visual/c3/coleta-cdbcb88/capturas/`, script `e2e/visual/c3/captura-head.mjs`.

## 1. Objetivo

Registrar o estado visual real por tela, tema e viewport no HEAD atual, substituindo o baseline histórico desatualizado e fornecendo critérios objetivos para aprovação das especificações antes de qualquer redesign de telas.

## 2. Matriz coletada

| Dimensão | Cobertura |
|---|---|
| Capturas | **110** (110 PNGs, 110 entradas no manifesto, 0 órfãos) |
| Viewport | mobile 70 (390×844, DPR 2) · desktop 40 (1440×900, DPR 1) |
| Modo | claro 55 · escuro 55 |
| Temas | 10 (5 claros + 5 escuros), 11 capturas por tema |
| Grupos de tela | 7: `tela-inicial` 20, `view-inicio` 20, `drawer-aberto` 20, `perfil` 20, `view-inicio-rolagem` 10, `perfil-rolagem` 10, `perfil-rolagem-nav-visivel` 10 |
| Estado | 110× `capturado`, 0 falhas, 0 paletas incorretas |
| Integridade | 110 SHA-256 distintos; hashes e bytes de cada PNG reconferidos contra o manifesto |

## 3. Metodologia da nova coleta

- Cada captura começa com `Page.navigate` + `loadEventFired` + espera por `document.fonts.ready`; nenhum estado é reaproveitado entre capturas.
- Temas aplicados pelas funções reais `applyLightTheme(id,false)` / `applyDarkTheme(id,false)` e classe `dark-mode`; dataset `--accent`/`--paper` computados e confrontados com o esperado.
- Navegação para a view desejada feita por manipulação controlada do DOM (`.tab-content.active`, `body.dataset.tab`, botões da barra inferior), sem alterar arquivos do app.
- Overlays de autenticação e seletor de temas ocultados em runtime; Drawer aberto somente no grupo `drawer-aberto` e fechado nos demais.
- Estados de rolagem: topo, `fundo` e `revelar-nav` (Volta 120 px para reexibir a barra inferior).
- Recursos externos (fontes/ícones/CDNs) **foram permitidos**, para refletir a aparência real; o manifesto registra os arquivos locais servidos com SHA-256 próprio.

## 4. Baseline histórico

O pacote `e2e/visual/c3/evidencias/` (110 capturas, `shaHEAD=ab656b9`, `shaPublicacao=e172cf4`) permanece **intacto** como registro histórico. Ele foi considerado obsoleto para o HEAD atual porque, entre a coleta antiga e `cdbcb88`, houve mudanças visuais relevantes:

- D-01: primeiro destino da barra inferior trocado de `dashboard` para `inicio`.
- D-02: nova entrada `inicio` no Drawer.
- D-05: composição/grid da view Início (`style/features.css`, ~75 linhas).
- D-03/D-04: Próximo Pagamento e Resumo do Fluxo passaram a renderizar também em Início.

A nova coleta usa `headSha` lido dinamicamente no início da execução (não hardcoded) e `publicacaoSha` pendente até o commit que publicar as imagens.

## 5. Paletas verificadas

| Tema | `--accent` | `--paper` |
|---|---|---|
| oliva-claro | `#5f7a43` | `#f7f5ef` |
| verde-claro | `#327957` | `#f8f7f2` |
| lima-claro | `#40916c` | `#faf9f6` |
| terracota-claro | `#c66f50` | `#fbf6ef` |
| laranja-claro | `#e85002` | `#f9f9f9` |
| oliva-escuro | `#9dd08b` | `#1a1917` |
| verde-escuro | `#22c55e` | `#121212` |
| bege-escuro | `#c9a86a` | `#0f1712` |
| terracota-escuro | `#d08860` | `#141410` |
| laranja-escuro | `#e85002` | `#000000` |

Todas as 110 capturas registraram `paletaVerificada = sim`; a existência da paleta correta **não** prova contraste WCAG de todos os pares — essa continua sendo responsabilidade do pacote C.4.

## 6. Critérios visuais propostos por grupo

| Grupo | Critério objetivo |
|---|---|
| `tela-inicial` | `#viewCaixa` ativa; barra inferior com 5 destinos e `caixa` selecionado; drawer e pickers ocultos. |
| `view-inicio` | `#viewInicio` ativa; cards de Patrimônio, Saúde, Próximo Pagamento e Resumo do Fluxo presentes; grid responsivo do C.1 mantido. |
| `drawer-aberto` | overlay do Drawer visível; nenhum picker visível; modo claro/escuro correto. |
| `perfil` | `#viewProfile` ativa; sem drawer/pickers; rolagem no topo. |
| `view-inicio-rolagem` | conteúdo abaixo da dobra; barra inferior ocultada intencionalmente; `scrollY > 0`. |
| `perfil-rolagem` | conteúdo inferior do Perfil; barra inferior ocultada; `scrollY > 0`. |
| `perfil-rolagem-nav-visivel` | mesma posição do grupo anterior com a barra inferior reexibida; 5 destinos visíveis. |

Critérios comuns: nenhum overlay de autenticação, nenhum seletor de tema visível, modo claro/escuro coerente com o tema aplicado, view ativa única (exceto `drawer-aberto`) e paleta computada igual à esperada.

## 7. Limitações

- Capturas são do ambiente local; build/publicação remota não foi certificada.
- Falhas de carregamento de CDNs não foram coletadas como evento separado; a aparência reflete o que o navegador carregou no momento.
- A especificação não foi aprovada por designer/revisor humano; o agente executor não pode declarar esse aceite.
- C.3 não aprova C.4–C.8 nem autoriza redesign em lote.

## 8. Pendências para aceite

- [x] Matriz 110 capturas coletada no HEAD atual.
- [x] Integridade do manifesto e dos PNGs verificada.
- [x] Paletas conferidas em todas as capturas.
- [ ] Revisão visual humana das capturas por tema/viewport.
- [ ] Aprovação desta especificação.
- [ ] Atualizar `publicacaoSha` no manifesto após o commit de publicação.

## 9. Evidências

`e2e/visual/c3/coleta-cdbcb88/manifest.json` · `e2e/visual/c3/coleta-cdbcb88/capturas/*.png` · `e2e/visual/c3/captura-head.mjs` · logs `tmp-c13/c3-http-server.log`, `tmp-c13/c3-chromium-claro.log`, `tmp-c13/c3-chromium-escuro.log`.
