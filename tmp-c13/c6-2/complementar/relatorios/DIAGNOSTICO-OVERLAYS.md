# Diagnóstico — capturas acinzentadas e overlays

## Evidências consultadas

- `../diag-block/diagnosticos/DIAGNOSTICO-diag-block-block.json`
- `../diag-allow/diagnosticos/DIAGNOSTICO-diag-allow-allow.json`
- Capturas viewport e fullpage de `390x844-light-1` e `1280x800-light-1`.

## Estado observado no harness atual

| Item | 390×844 light-1 | 1280×800 light-1 |
|---|---|---|
| URL | `http://127.0.0.1:8123/index.html` | idem |
| `document.body.className` | `""` | `""` |
| `body.dataset.tab` | `inicio` | `inicio` |
| `body.is-data-loading` | `false` | `false` |
| `body.tab-changing` | `false` | `false` |
| `authOverlay` | `display:none` | `display:none` |
| `syncOverlay` | `display:none` | `display:none` |
| `modalOverlay` | `display:none`, `opacity:0` | `display:none`, `opacity:0` |
| `.panel.open` | nenhum | nenhum |

Não havia painéis, modais, loading ou transição de navegação/tema pendente no momento das capturas. O harness aguarda dois frames + 260ms após cada troca de tema.

## Elementos fixos com opacidade/filtro

Em 390×844, o único elemento fixo visível com filtro é `.mobile-bottom-nav`:

- `position: fixed`
- `z-index: 70`
- `background-color: color(srgb 1 0.996078 0.980392 / 0.5)`
- `backdrop-filter: blur(8px) saturate(1.35)`

Trata-se da navegação inferior legítima, translúcida por design. Em 1280×800, nenhum elemento fixo com essas características foi encontrado.

## Causa das capturas acinzentadas históricas

As capturas antigas que mostravam uma faixa cinza foram produzidas por uma versão anterior do harness em que `#universalPeriodBar` não era ocultado. Ele aparecia como bloco cinza entre a faixa financeira e o cabeçalho da view Início.

O harness atual oculta explicitamente `#authOverlay`, `#syncOverlay`, `#modalOverlay`, `.modal-overlay`, `#toastContainer` e `#universalPeriodBar` — todos artefatos de estado/setup da captura — e não neutraliza FAB ou navegação inferior.

## Conclusão

**Limitação do harness, não defeito de produção.** Não foi encontrado overlay legítimo do aplicativo causando o cinza nas capturas atuais. Nenhuma alteração de CSS de produção foi feita para este item.

A distinção viewport/full-page é necessária porque elementos `position:fixed` podem aparecer sobre regiões centrais em capturas de página inteira. Para avaliar FAB e navegação inferior, usar somente as imagens de `viewport/`.
