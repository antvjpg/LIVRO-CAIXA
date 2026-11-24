# Diagnóstico — carregamento de ícones no Chromium/CDP

## Comparação controlada

| Modo | Requests | Responses | Falhas | `console.error` | Exceções JS |
|---|---:|---:|---:|---:|---:|
| `C6_ICON_MODE=block` (harness anterior) | 58 | 11 | 47 | 0 | 0 |
| `C6_ICON_MODE=allow` (recursos externos liberados) | 88 | 88 | 0 | 0 | 0 |

No modo `block`, as 47 falhas têm `blockedReason: "inspector"` — são bloqueios intencionais do próprio harness via `Network.setBlockedURLs`, incluindo 2 requisições para `cdn-uicons.flaticon.com`, além de `fonts.googleapis.com`, `gstatic.com`, `cdnjs.cloudflare.com`, `jsdelivr.net` e arquivos locais `/js/*`.

No modo `allow`, não houve falha de rede, CORS ou CSP registrada. O único aviso de console foi a depreciação futura de `enableIndexedDbPersistence()` do Firestore, sem relação com ícones.

## Evidência nos glifos da faixa

Modo `block`:

- `.fi.fi-rr-bank`, `.fi.fi-rr-piggy-bank`, `.fi.fi-rr-chat-arrow-grow`
- `font-family` calculado: `"Plus Jakarta Sans", sans-serif`
- `::before.content`: `none`

Modo `allow`:

- `::before.content`: `"\e186"`, `"\ee3a"`, `"\e3ce"`
- `::before.font-family`: `uicons-regular-rounded`

Capturas comparativas:

- `../diag-block/viewport/viewport-390x844-light-1.png` — quadrados vazios.
- `../diag-allow/viewport/viewport-390x844-light-1.png` — ícones renderizados.

## Observação sobre `document.fonts.check()`

`document.fonts.check('16px "uicons-regular-rounded"')` retornou `true` mesmo no modo bloqueado, portanto esse sinal isolado não é confiável aqui. O diagnóstico decisivo foi o conteúdo calculado de `::before` e a família de fonte efetiva do pseudo-elemento.

`tabler-icons` retornou `false` nos dois modos porque o harness injeta apenas os cards da faixa com classes `fi`; não há glifo `.ti` na amostra. Isso não é evidência de defeito na biblioteca local.

## Conclusão

**Limitação do harness, não defeito do produto.** Os ícones `fi` dependem do CSS/fonte externa Flaticon/Uicons. O harness da C6-INICIO-02 bloqueava esse domínio para acelerar a captura e isolar o app, produzindo os quadrados vazios. Com os recursos liberados, os ícones carregam corretamente no mesmo Chromium/CDP.

Nenhuma alteração de iconografia, biblioteca ou `index.html` foi feita nesta rodada.
