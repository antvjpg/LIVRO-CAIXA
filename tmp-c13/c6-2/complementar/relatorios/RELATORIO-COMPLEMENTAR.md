# C6-INICIO-02 — Relatório da rodada complementar

## 1. Identificação

- **Branch:** `feat/app-layout-redesign`
- **HEAD inicial:** `38b6b81e4f413db18ea7414309d4e77d55fffa75`
- **HEAD final:** `38b6b81e4f413db18ea7414309d4e77d55fffa75`
- **Ancestralidade:** `38b6b81` confirmada via `git merge-base --is-ancestor`.
- **Estado Git inicial:** limpo (`git status --short` sem saída).
- **Estado Git final:** `M style/features.css`; `?? tmp-c13/c6-2/complementar/`; `?? tmp-c13/c6-2/harness/`.

## 2. Arquivos alterados

### Produção

- `style/features.css` — 5 linhas adicionadas, nenhuma removida.

### Validação/evidência

- `tmp-c13/c6-2/harness/inicio-visual-audit.cjs` — harness versionado com captura viewport, fullpage, recorte do card, diagnóstico de overlays/fontes/redes.
- `tmp-c13/c6-2/complementar/` — 312 PNGs, 4 matrizes, 4 diagnósticos JSON, 3 relatórios, 3 saídas de teste.
- `tmp-c13/c6-2/SHA256-COMPLEMENTAR.sha256` — 327 hashes.

## 3. Alteração de produção

### Trecho anterior

```css
body[data-tab="inicio"] #balanceStrip .balance-card .amount{
  font-size:clamp(18px, 2.4vw, 22px);
  overflow-wrap:anywhere;
}
```

### Trecho novo

```css
body[data-tab="inicio"] #balanceStrip .balance-card .amount{
  font-size:clamp(18px, 2.4vw, 22px);
  overflow-wrap:anywhere;
}
body[data-tab="inicio"] #balanceStrip > .bank-summary-card .amount{
  font-size:clamp(22px, 3vw, 32px);
  line-height:1.05;
  letter-spacing:-.035em;
}
```

**Arquivo/seletor:** `style/features.css`, `body[data-tab="inicio"] #balanceStrip > .bank-summary-card .amount`.

**Justificativa:** o card Bancos ocupa toda a primeira linha, mas usava a mesma escala de Caixinhas e Investimentos. A nova escala responsiva vai de 22px no mobile a 32px no desktop, mantendo `line-height: 1.05` para compensar o aumento e evitar crescimento desnecessário da altura. O seletor é o mais específico possível e não alcança Livro-Caixa, Caixinhas, Investimentos, Patrimônio Total, Visão Geral ou qualquer outro componente.

## 4. Evidência antes/depois do card Bancos

| Viewport | Antes | Depois | Diferença de altura |
|---|---|---|---|
| 320×720 | 18px / 121,80px | 22px / 123,89px | +2,09px |
| 360×800 | 18px / 121,80px | 22px / 123,89px | +2,09px |
| 390×844 | 18px / 121,80px | 22px / 123,89px | +2,09px |
| 768×1024 | 18,432px / 125,80px | 23,04px / 128,98px | +3,18px |
| 1280×800 | 22px / 129,80px | 32px / 138,39px | +8,59px |

Caixinhas e Investimentos permaneceram em 18px (320–390), 18,432px (768) e 22px (1280).

Relatório visual: `tmp-c13/c6-2/complementar/relatorios/COMPARATIVO-BANCOS.md`.

## 5. Diagnóstico das capturas acinzentadas

- No harness atual, `body.className` está vazio, `is-data-loading=false`, `tab-changing=false`.
- `authOverlay`, `syncOverlay` e `modalOverlay` estão com `display:none`; não há `.panel.open`.
- O único elemento fixo com filtro em 390×844 é `.mobile-bottom-nav` (`backdrop-filter: blur(8px) saturate(1.35)`, fundo semitransparente), legítimo por design. Em 1280×800 não há elemento fixo desse tipo.
- As capturas acinzentadas históricas vieram de versão anterior do harness em que `#universalPeriodBar` permanecia visível; o harness atual oculta esse artefato de setup.

**Conclusão:** limitação do harness, não defeito de produção. Nenhum CSS de overlay/fundo foi alterado.

Relatório: `tmp-c13/c6-2/complementar/relatorios/DIAGNOSTICO-OVERLAYS.md`.

## 6. Diagnóstico dos ícones

- Modo `block`: 58 requests, 11 responses, 47 falhas `blockedReason: "inspector"` — bloqueios intencionais do harness, incluindo `cdn-uicons.flaticon.com`. Glifos `fi` com `::before.content: none` e fonte calculada `"Plus Jakarta Sans"`.
- Modo `allow`: 88 requests, 88 responses, 0 falhas. Glifos `fi` com `::before.content` `"\e186"`, `"\ee3a"`, `"\e3ce"` e `beforeFontFamily: uicons-regular-rounded`.
- `document.fonts.check()` isolado não foi conclusivo; o conteúdo calculado de `::before` foi o critério decisivo.
- Nenhum erro de rede, CORS ou CSP no modo `allow`. O único aviso foi depreciação futura do Firestore, sem relação com ícones.

**Conclusão:** limitação do harness, não defeito do produto. Nenhuma biblioteca, fonte ou ícone foi substituído.

Relatório: `tmp-c13/c6-2/complementar/relatorios/DIAGNOSTICO-ICONS.md`.

## 7. Viewport × full-page

- `viewport-*.png`: captura restrita à área visível; usada para avaliar FAB e navegação inferior na posição real. Em 390×844 e 320×720, ambos aparecem corretamente na viewport. Em 320px, o FAB sobrepõe lateralmente o texto do breakdown — comportamento pré-existente, fora do escopo C6-INICIO-07.
- `fullpage-*.png`: documentação complementar da composição completa; não usada isoladamente para concluir posicionamento de elementos fixos.
- `card-bancos-*.png`: recorte do card para comparação antes/depois.

Exemplo: `tmp-c13/c6-2/complementar/depois/viewport/viewport-768x1024-light-1.png` não apresenta faixa cinza; o mesmo é visto em `fullpage-768x1024-light-1.png` com o harness atual.

## 8. Matriz visual

- **5 viewports:** 320×720, 360×800, 390×844, 768×1024, 1280×800.
- **10 temas:** claro 1–5 e escuro 1–5.
- **50 combinações por rodada.**
- **150 capturas por rodada:** 50 viewport + 50 fullpage + 50 recortes do card Bancos.
- **Rodadas:** `antes` e `depois`, mais 2 diagnósticos controlados (`diag-block`, `diag-allow`).

Resultado consolidado nas matrizes `MATRIZ-antes-block.md` e `MATRIZ-depois-block.md`:

- Overflow horizontal: **PASS em 50/50**.
- Canvas sem corte: **PASS em 50/50**.
- Composição triangular: **PASS em 50/50**.
- Nenhuma falha de captura.

Matrizes: `tmp-c13/c6-2/complementar/{antes,depois}/diagnosticos/`.

## 9. Testes executados

| Comando/verificação | Resultado |
|---|---|
| `git diff --check` | PASS |
| `node --check tmp-c13/c6-2/harness/inicio-visual-audit.cjs` | PASS |
| `npm run code:syntax` | PASS — 31 arquivos `.js`, 0 blocos inline |
| `npm run code:oracles` | PASS — 149/149 |
| `npm run code:security` | PASS — 94/94 |
| Harness CDP `antes` (block) | PASS — 150 capturas, 0 falhas de layout |
| Harness CDP `depois` (block) | PASS — 150 capturas, 0 falhas de layout |
| Diagnóstico CDP block/allow | Concluído; 0 exceções JS |

## 10. Testes bloqueados

- `npm run code:smoke` / qualquer suíte Playwright local: **BLOCKED**, `playwright: not found`, exit `127`. Evidência em `tmp-c13/c6-2/complementar/testes/e2e-local-blocked.txt`.
- Não houve instalação de dependências nem simulação de sucesso. A execução devida é o workflow C.O.D.E. via disparo manual no GitHub, preservando a restrição atual de disparo apenas em `main`.

## 11. Regressão funcional

- Não houve alteração em JavaScript, cálculos, persistência, navegação, gráficos ou listeners — o diff de produção é exclusivamente CSS.
- O harness confirmou: faixa triangular preservada, canvas sem corte, Caixinhas/Investimentos com escala inalterada, nenhum overflow e nenhuma exceção JS.
- Livro-Caixa, Visão Geral, Saúde Financeira, Próximo Pagamento e Resumo do Fluxo não foram modificados nesta rodada e permanecem como na revisão anterior.

## 12. Pendências

- Revisão técnica cruzada do diff e das novas capturas.
- Execução manual do C.O.D.E. no GitHub para validar o teste E2E atualizado em ambiente autenticado.
- A etapa C6-INICIO-02 **não** é declarada concluída apenas por esta rodada; depende da revisão do solicitante.

## 13. Artefatos e hashes

- Diretório raiz: `tmp-c13/c6-2/complementar/`
- Harness: `tmp-c13/c6-2/harness/inicio-visual-audit.cjs`
- Hashes: `tmp-c13/c6-2/SHA256-COMPLEMENTAR.sha256` (328 entradas)
- Evidências históricas `tmp-c13/c6-2/MATRIZ.md` e `tmp-c13/c6-2/screenshots/` foram preservadas e não substituídas.

## 14. Confirmação de escopo

Nenhuma alteração foi feita em: composição triangular, Patrimônio Total, Saúde Financeira, Próximo Pagamento, Resumo do Fluxo, cálculos financeiros, Firebase/Firestore, autenticação, persistência, navegação, FAB, barra inferior, LIA, temas globais, iconografia, `main`, workflows, ou commits/push/merge/release/deploy.
