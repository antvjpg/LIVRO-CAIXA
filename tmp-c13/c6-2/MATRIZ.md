# C6-INICIO-02 — matriz visual (Chromium headless + CDP)

| Viewport | Tema | Overflow horizontal | Canvas sem corte | Composição triangular |
|---|---|---|---|---|
| 320x720 | light-1 | PASS | PASS | PASS |
| 320x720 | light-2 | PASS | PASS | PASS |
| 320x720 | light-3 | PASS | PASS | PASS |
| 320x720 | light-4 | PASS | PASS | PASS |
| 320x720 | light-5 | PASS | PASS | PASS |
| 320x720 | dark-1 | PASS | PASS | PASS |
| 320x720 | dark-2 | PASS | PASS | PASS |
| 320x720 | dark-3 | PASS | PASS | PASS |
| 320x720 | dark-4 | PASS | PASS | PASS |
| 320x720 | dark-5 | PASS | PASS | PASS |
| 360x800 | light-1 | PASS | PASS | PASS |
| 360x800 | light-2 | PASS | PASS | PASS |
| 360x800 | light-3 | PASS | PASS | PASS |
| 360x800 | light-4 | PASS | PASS | PASS |
| 360x800 | light-5 | PASS | PASS | PASS |
| 360x800 | dark-1 | PASS | PASS | PASS |
| 360x800 | dark-2 | PASS | PASS | PASS |
| 360x800 | dark-3 | PASS | PASS | PASS |
| 360x800 | dark-4 | PASS | PASS | PASS |
| 360x800 | dark-5 | PASS | PASS | PASS |
| 390x844 | light-1 | PASS | PASS | PASS |
| 390x844 | light-2 | PASS | PASS | PASS |
| 390x844 | light-3 | PASS | PASS | PASS |
| 390x844 | light-4 | PASS | PASS | PASS |
| 390x844 | light-5 | PASS | PASS | PASS |
| 390x844 | dark-1 | PASS | PASS | PASS |
| 390x844 | dark-2 | PASS | PASS | PASS |
| 390x844 | dark-3 | PASS | PASS | PASS |
| 390x844 | dark-4 | PASS | PASS | PASS |
| 390x844 | dark-5 | PASS | PASS | PASS |
| 768x1024 | light-1 | PASS | PASS | PASS |
| 768x1024 | light-2 | PASS | PASS | PASS |
| 768x1024 | light-3 | PASS | PASS | PASS |
| 768x1024 | light-4 | PASS | PASS | PASS |
| 768x1024 | light-5 | PASS | PASS | PASS |
| 768x1024 | dark-1 | PASS | PASS | PASS |
| 768x1024 | dark-2 | PASS | PASS | PASS |
| 768x1024 | dark-3 | PASS | PASS | PASS |
| 768x1024 | dark-4 | PASS | PASS | PASS |
| 768x1024 | dark-5 | PASS | PASS | PASS |
| 1280x800 | light-1 | PASS | PASS | PASS |
| 1280x800 | light-2 | PASS | PASS | PASS |
| 1280x800 | light-3 | PASS | PASS | PASS |
| 1280x800 | light-4 | PASS | PASS | PASS |
| 1280x800 | light-5 | PASS | PASS | PASS |
| 1280x800 | dark-1 | PASS | PASS | PASS |
| 1280x800 | dark-2 | PASS | PASS | PASS |
| 1280x800 | dark-3 | PASS | PASS | PASS |
| 1280x800 | dark-4 | PASS | PASS | PASS |
| 1280x800 | dark-5 | PASS | PASS | PASS |

## Consistência de layout por viewport (10 temas)

- 320x720: PASS — 131px 131px | 277px | true
- 360x800: PASS — 151px 151px | 317px | true
- 390x844: PASS — 166px 166px | 347px | true
- 768x1024: PASS — 345px 345px | 344.5px 344.5px | true
- 1280x800: PASS — 528.5px 528.5px | 528px 528px | true

## Evidências

- `screenshots/inicio-320x720-light-1.png` (canvas 231px / caixa 231px; tokens surface=#FFFEFA, ink=#1A2417, accent=#5F7A43)
- `screenshots/inicio-320x720-light-2.png` (canvas 231px / caixa 231px; tokens surface=#FFFEFA, ink=#19352A, accent=#327957)
- `screenshots/inicio-320x720-light-3.png` (canvas 231px / caixa 231px; tokens surface=#ffffff, ink=#31572C, accent=#40916C)
- `screenshots/inicio-320x720-light-4.png` (canvas 231px / caixa 231px; tokens surface=#FFFDF8, ink=#342C25, accent=#C66F50)
- `screenshots/inicio-320x720-light-5.png` (canvas 231px / caixa 231px; tokens surface=#FFFFFF, ink=#1A1A1A, accent=#E85002)
- `screenshots/inicio-320x720-dark-1.png` (canvas 231px / caixa 231px; tokens surface=#232120, ink=#F1EDE1, accent=#9DD08B)
- `screenshots/inicio-320x720-dark-2.png` (canvas 231px / caixa 231px; tokens surface=#1C1C1E, ink=#FFFFFF, accent=#22C55E)
- `screenshots/inicio-320x720-dark-3.png` (canvas 231px / caixa 231px; tokens surface=#16211A, ink=#F3EFE4, accent=#C9A86A)
- `screenshots/inicio-320x720-dark-4.png` (canvas 231px / caixa 231px; tokens surface=#1E1F17, ink=#F5F1E6, accent=#D08860)
- `screenshots/inicio-320x720-dark-5.png` (canvas 231px / caixa 231px; tokens surface=#121212, ink=#F9F9F9, accent=#E85002)
- `screenshots/inicio-360x800-light-1.png` (canvas 271px / caixa 271px; tokens surface=#FFFEFA, ink=#1A2417, accent=#5F7A43)
- `screenshots/inicio-360x800-light-2.png` (canvas 271px / caixa 271px; tokens surface=#FFFEFA, ink=#19352A, accent=#327957)
- `screenshots/inicio-360x800-light-3.png` (canvas 271px / caixa 271px; tokens surface=#ffffff, ink=#31572C, accent=#40916C)
- `screenshots/inicio-360x800-light-4.png` (canvas 271px / caixa 271px; tokens surface=#FFFDF8, ink=#342C25, accent=#C66F50)
- `screenshots/inicio-360x800-light-5.png` (canvas 271px / caixa 271px; tokens surface=#FFFFFF, ink=#1A1A1A, accent=#E85002)
- `screenshots/inicio-360x800-dark-1.png` (canvas 271px / caixa 271px; tokens surface=#232120, ink=#F1EDE1, accent=#9DD08B)
- `screenshots/inicio-360x800-dark-2.png` (canvas 271px / caixa 271px; tokens surface=#1C1C1E, ink=#FFFFFF, accent=#22C55E)
- `screenshots/inicio-360x800-dark-3.png` (canvas 271px / caixa 271px; tokens surface=#16211A, ink=#F3EFE4, accent=#C9A86A)
- `screenshots/inicio-360x800-dark-4.png` (canvas 271px / caixa 271px; tokens surface=#1E1F17, ink=#F5F1E6, accent=#D08860)
- `screenshots/inicio-360x800-dark-5.png` (canvas 271px / caixa 271px; tokens surface=#121212, ink=#F9F9F9, accent=#E85002)
- `screenshots/inicio-390x844-light-1.png` (canvas 301px / caixa 301px; tokens surface=#FFFEFA, ink=#1A2417, accent=#5F7A43)
- `screenshots/inicio-390x844-light-2.png` (canvas 301px / caixa 301px; tokens surface=#FFFEFA, ink=#19352A, accent=#327957)
- `screenshots/inicio-390x844-light-3.png` (canvas 301px / caixa 301px; tokens surface=#ffffff, ink=#31572C, accent=#40916C)
- `screenshots/inicio-390x844-light-4.png` (canvas 301px / caixa 301px; tokens surface=#FFFDF8, ink=#342C25, accent=#C66F50)
- `screenshots/inicio-390x844-light-5.png` (canvas 301px / caixa 301px; tokens surface=#FFFFFF, ink=#1A1A1A, accent=#E85002)
- `screenshots/inicio-390x844-dark-1.png` (canvas 301px / caixa 301px; tokens surface=#232120, ink=#F1EDE1, accent=#9DD08B)
- `screenshots/inicio-390x844-dark-2.png` (canvas 301px / caixa 301px; tokens surface=#1C1C1E, ink=#FFFFFF, accent=#22C55E)
- `screenshots/inicio-390x844-dark-3.png` (canvas 301px / caixa 301px; tokens surface=#16211A, ink=#F3EFE4, accent=#C9A86A)
- `screenshots/inicio-390x844-dark-4.png` (canvas 301px / caixa 301px; tokens surface=#1E1F17, ink=#F5F1E6, accent=#D08860)
- `screenshots/inicio-390x844-dark-5.png` (canvas 301px / caixa 301px; tokens surface=#121212, ink=#F9F9F9, accent=#E85002)
- `screenshots/inicio-768x1024-light-1.png` (canvas 659px / caixa 659px; tokens surface=#FFFEFA, ink=#1A2417, accent=#5F7A43)
- `screenshots/inicio-768x1024-light-2.png` (canvas 659px / caixa 659px; tokens surface=#FFFEFA, ink=#19352A, accent=#327957)
- `screenshots/inicio-768x1024-light-3.png` (canvas 659px / caixa 659px; tokens surface=#ffffff, ink=#31572C, accent=#40916C)
- `screenshots/inicio-768x1024-light-4.png` (canvas 659px / caixa 659px; tokens surface=#FFFDF8, ink=#342C25, accent=#C66F50)
- `screenshots/inicio-768x1024-light-5.png` (canvas 659px / caixa 659px; tokens surface=#FFFFFF, ink=#1A1A1A, accent=#E85002)
- `screenshots/inicio-768x1024-dark-1.png` (canvas 659px / caixa 659px; tokens surface=#232120, ink=#F1EDE1, accent=#9DD08B)
- `screenshots/inicio-768x1024-dark-2.png` (canvas 659px / caixa 659px; tokens surface=#1C1C1E, ink=#FFFFFF, accent=#22C55E)
- `screenshots/inicio-768x1024-dark-3.png` (canvas 659px / caixa 659px; tokens surface=#16211A, ink=#F3EFE4, accent=#C9A86A)
- `screenshots/inicio-768x1024-dark-4.png` (canvas 659px / caixa 659px; tokens surface=#1E1F17, ink=#F5F1E6, accent=#D08860)
- `screenshots/inicio-768x1024-dark-5.png` (canvas 659px / caixa 659px; tokens surface=#121212, ink=#F9F9F9, accent=#E85002)
- `screenshots/inicio-1280x800-light-1.png` (canvas 1026px / caixa 1026px; tokens surface=#FFFEFA, ink=#1A2417, accent=#5F7A43)
- `screenshots/inicio-1280x800-light-2.png` (canvas 1026px / caixa 1026px; tokens surface=#FFFEFA, ink=#19352A, accent=#327957)
- `screenshots/inicio-1280x800-light-3.png` (canvas 1026px / caixa 1026px; tokens surface=#ffffff, ink=#31572C, accent=#40916C)
- `screenshots/inicio-1280x800-light-4.png` (canvas 1026px / caixa 1026px; tokens surface=#FFFDF8, ink=#342C25, accent=#C66F50)
- `screenshots/inicio-1280x800-light-5.png` (canvas 1026px / caixa 1026px; tokens surface=#FFFFFF, ink=#1A1A1A, accent=#E85002)
- `screenshots/inicio-1280x800-dark-1.png` (canvas 1026px / caixa 1026px; tokens surface=#232120, ink=#F1EDE1, accent=#9DD08B)
- `screenshots/inicio-1280x800-dark-2.png` (canvas 1026px / caixa 1026px; tokens surface=#1C1C1E, ink=#FFFFFF, accent=#22C55E)
- `screenshots/inicio-1280x800-dark-3.png` (canvas 1026px / caixa 1026px; tokens surface=#16211A, ink=#F3EFE4, accent=#C9A86A)
- `screenshots/inicio-1280x800-dark-4.png` (canvas 1026px / caixa 1026px; tokens surface=#1E1F17, ink=#F5F1E6, accent=#D08860)
- `screenshots/inicio-1280x800-dark-5.png` (canvas 1026px / caixa 1026px; tokens surface=#121212, ink=#F9F9F9, accent=#E85002)

## Capturas completas

- `screenshots/inicio-full-390x844-light-1.png`
- `screenshots/inicio-full-1280x800-light-1.png`
