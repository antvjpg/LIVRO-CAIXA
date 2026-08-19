# Validação determinística V17-16

A validação abaixo foi executada na cópia independente:

| Verificação | Resultado |
|---|---|
| `node --check` do JavaScript extraído do HTML | PASS |
| `node --check sw.js` | PASS |
| JSON do `manifest.webmanifest` | PASS |
| Legenda com `overflow-wrap:anywhere` e `text-overflow:clip` | PASS |
| Valores/percentuais com `min-width:max-content` e `white-space:nowrap` | PASS |
| Ícones de atalhos, navegação, Perfil e ações beta | PASS |
| Ícones financeiros `category-dot` e `movement-category-icon` | PASS |
| Agregação `chartSpend` e categoria de exibição `Outras` | PASS |
| Total baseado em `totalSpend` independente da agregação visual | PASS |

Esta verificação é estática e não substitui a validação autenticada do Firebase.
