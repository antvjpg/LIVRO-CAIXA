# Relatório de implementação — C6-INICIO-05

**Base:** `de4ee7f` (`feat/app-layout-redesign`) · **Commit de implementação/HEAD:** `bdfb965`
**Data:** 2026-11-26  
**Escopo:** acessibilidade do gráfico de evolução patrimonial da Início.  
**Fora do escopo:** validação dinâmica de teclado/foco/ARIA em cenários de interação — reservada à C6-INICIO-09.

## 1. Diagnóstico revisado

| Indicador | Diagnóstico anterior | Resultado |
|---|---|---|
| A-01 | `aria-label` fixo em “últimos 6 meses” | Corrigido |
| A-02 | Série histórica sem alternativa textual | Corrigido |
| A-03 | Estado vazio sem anúncio dinâmico explícito | Corrigido e validado em CDP |
| A-04 | Estrutura do controle de expansão | Preservada |

## 2. Correções implementadas

### A-01 — descrição do período

**Antes:** `index.html` mantinha:
```html
<canvas id="patrimonySparklineInicio" role="img" aria-label="Evolução do patrimônio nos últimos 6 meses"></canvas>
```

**Depois:** o renderer passa a atualizar o rótulo conforme `inicioPeriodKey()`:
```js
if (isInicioEvolution && canvas) {
  canvas.setAttribute('aria-label', `Evolução do patrimônio ${inicioEvolutionPeriodPhrase()}`);
}
```

Frases: `3m` → “nos últimos 3 meses”; `6m` → “nos últimos 6 meses”; `1y` → “no último ano”.

### A-02 — alternativa textual

**Antes:** não havia descrição textual da série; apenas tooltip por clique em um ponto.

**Depois:**
- `<canvas ... aria-describedby="inicioEvolutionData">`
- `<div id="inicioEvolutionData" class="card-visually-hidden"></div>`
- `updateInicioEvolutionData(series)` gera o texto a partir da **mesma série** usada pelo Chart.js (`dashboardMonthSeries`), sem nova fonte de dados.

Trecho:
```js
host.textContent = `Evolução do patrimônio ${inicioEvolutionPeriodPhrase()}: ${values}.`;
```

A chamada foi colocada após `setInicioEvolutionEmpty(false)` nas duas rotas de render (criação e atualização da instância), para que a descrição não seja apagada pelo fluxo de reconstrução do gráfico.

### A-03 — anúncio do estado vazio

**Antes:**
```html
<p class="inicio-patrimony-evolution-empty" id="inicioPatrimonyEvolutionEmpty" hidden>...</p>
```

**Depois:**
```html
<p class="inicio-patrimony-evolution-empty" id="inicioPatrimonyEvolutionEmpty" role="status" aria-live="polite" hidden>...</p>
```

Quando o gráfico é destruído/oculto, `setInicioEvolutionEmpty(true)` mostra a mensagem e limpa a alternativa textual.

## 3. Preservação

- Visual do gráfico inalterado.
- Seletor `#inicioPeriodSelect` e opções `3m/6m/1y` inalterados.
- Instâncias separadas `inicio`/`strip` preservadas.
- Toggle de visibilidade, tooltip e pílula percentual preservados.
- Nenhuma alteração na BNI, no Header, na Visão Geral ou em outras abas.

## 4. Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `index.html` | `aria-describedby`, host da alternativa textual e `role=status`/`aria-live` no estado vazio. |
| `js/18-render-core.js` | Descrição dinâmica do período, geração da alternativa textual e limpeza no estado vazio. |
| `e2e/smoke/inicio.spec.js` | Asserções de rótulo, descrição, quantidade de pontos e atributos do estado vazio. |

## 5. Validações

| Validação | Estado | Resultado |
|---|---|---|
| `node --check` | PASS | JS alterados válidos. |
| `git diff --check` | PASS | Sem erros. |
| `npm run code:syntax` | PASS | `SINTAXE: OK (0 bloco(s) inline de index.html + 31 arquivo(s) .js)`. |
| `npm run code:oracles` | PASS | 149 testes, 149 pass, 0 fail. |
| `npm run code:security` | PASS | 94 testes, 94 pass, 0 fail. |
| CDP — rótulo 3m | PASS | “Evolução do patrimônio nos últimos 3 meses”. |
| CDP — rótulo 6m | PASS | “Evolução do patrimônio nos últimos 6 meses”. |
| CDP — rótulo 1y | PASS | “Evolução do patrimônio no último ano”. |
| CDP — alternativa textual | PASS | 3, 6 e 12 entradas respectivamente; host oculto visualmente. |
| CDP — estado vazio | PASS | AX tree com `role=status`, `live=polite`, `atomic=true`, `relevant=additions text`. |
| `e2e/smoke/inicio.spec.js` | BLOCKED | Playwright indisponível no Android. |
| C.O.D.E. remoto | NOT RUN | Não autorizado. |
| Auditoria independente | NOT RUN | Aguardando revisão externa. |

Evidência: `tmp-c13/c6-3/validacao-acessibilidade-grafico.json`.

## 6. Limitações

- A validação CDP usa dados fictícios e força a visibilidade do gráfico; não substitui execução com usuário autenticado.
- Teclado, foco real e sincronização dinâmica de ARIA continuam em C6-INICIO-09.
- Não foi feito commit, push, merge, release ou deploy.

## 7. Resultado

A-01, A-02 e A-03 estão corrigidos no escopo estático e validados localmente por CDP. A-04 permanece aprovado sem alteração. A tarefa C6-INICIO-05 fica pronta para revisão, mas não é apresentada como aceite final enquanto o E2E e a auditoria independente não forem executados.
