# DIAGNÓSTICO R2.5.3 — Correções funcionais de visibilidade ancestral, pseudoestado e travessia da raiz

Data: 2026-11-14  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-5-2/`  
Commit-base: `bef9f71edbe80c1515f8f3105f9592d56f2868e8`  
Branch: `feat/app-navigation-redesign`  
Artefatos preservados: R2.5.2 integralmente (114 testes, 7 hashes de integridade).

---

## 1. Contexto

A R2.5.2 foi aprovada com 114 testes passando (0 FAIL, 0 BLOCKED). Uma auditoria independente identificou três falhas funcionais e uma lacuna de rastreabilidade no núcleo `c4-v05-b-r2-5-2-core.cjs` que precisam ser corrigidas antes da aprovação do harness. Esta tarefa é exclusivamente corretiva: não reestrutura o harness, não recria os 114 testes, não inicia R2.6/R2.7 e não altera arquivos de produção.

---

## 2. Tabela de problemas encontrados

| # | Arquivo | Função/trecho | Problema | Causa-raiz | Consequência |
|---|---------|---------------|----------|------------|--------------|
| 1 | `c4-v05-b-r2-5-2-core.cjs` | Travessia de ancestrais (linhas ~918-922) | Interrompe a travessia no primeiro ancestral com `visibility:hidden` ou `collapse` | `break` imediato ao encontrar ancestral com visibility oculto, sem considerar sobrescrita do descendente | Elemento com `visibility:visible` dentro de ancestral `visibility:hidden` é incorretamente classificado como oculto; opacidade e `display:none` de ancestrais acima não são verificados |
| 2 | `c4-v05-b-r2-5-2-core.cjs` | Aplicação de pseudoestado (linhas ~709-722) | Falha de `CSS.forcePseudoState` não descarta a amostra | `pseudoApplied = true` é definido antes da chamada; exceção é capturada mas a coleta de estilo prossegue | Amostra pode ser produzida sem o pseudoestado efetivamente aplicado (falsa medição de `:hover`, `:focus`, etc.) |
| 3 | `c4-v05-b-r2-5-2-core.cjs` | Travessia da raiz (linhas ~908-911) | Interrompe a travessia ao encontrar `isRoot` ANTES de examinar as propriedades da raiz | `break` imediato no `isRoot`, sem processar `display`/`visibility`/`opacity` do elemento `html` | `html { opacity: 0 }` não é acumulado; `html { display: none }` não é detectado; falso positivo de visibilidade |
| 4 | `c4-v05-b-r2-5-2-core.cjs` | Acumulação de opacidade (linhas ~923-928) | Opacidade dos ancestrais não acumulada sobre a raiz | Devido ao problema #3, o loop encerra antes de processar a raiz | Opacidade aplicada ao elemento raiz é ignorada |

---

## 3. Análise detalhada de cada problema

### 3.1 Problema 1 — Semântica de `visibility` na travessia ancestral

**Trecho atual (core.cjs, linhas 913-922):**
```javascript
if (styleVal.display === 'none') {
  ancestorHiddenAcc = true;
  ancestorVisibility = 'completed';
  break;
}
if (styleVal.visibility === 'hidden' || styleVal.visibility === 'collapse') {
  ancestorHiddenAcc = true;
  ancestorVisibility = 'completed';
  break;
}
```

**Causa-raiz:** O algoritmo `break`s ao encontrar o primeiro ancestral com `visibility:hidden` ou `collapse`, definindo `ancestorHiddenAcc = true` e encerrando a análise. Isso ignora que `visibility` é uma propriedade herdável que pode ser sobrescrita pelo descendente (`visibility:visible`). Além disso, o `break` impede a verificação de `display:none` e a acumulação de opacidade em ancestrais acima daquele ponto.

**Consequência:** Um elemento com `visibility:visible` dentro de um ancestral `visibility:hidden` é classificado como `hidden`, mesmo quando seu estilo computado indica `visible`. Ancestrais acima com `opacity:0` ou `display:none` não são verificados.

**Fluxo de execução atual:**
```
elemento → pai(visibility:hidden) → BREAK → ancestorHiddenAcc=true → visibilityStatus='hidden'
```
Não há oportunidade de verificar se o elemento próprio sobrescreveu a visibilidade nem de examinar ancestrais acima do pai.

**Testes atuais relacionados:** D9 (visibility:hidden ancestral → hidden), D10 (visibility:collapse ancestral → hidden). Ambos passam porque o elemento filho NÃO sobrescreve a visibilidade, então o estilo computado do filho é 'hidden' (herdado).

**Testes ausentes:** V1-V10 da especificação R2.5.3 (sobreescrita de visibility, display:none absoluto, múltiplos ancestrais, falha de leitura).

### 3.2 Problema 2 — Falha de aplicação de pseudoestado não é invalidante

**Trecho atual (core.cjs, linhas 707-723):**
```javascript
try {
  if (state !== 'normal') {
    pseudoApplied = true;
    try {
      await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('CSS.forcePseudoState-apply', ...));
      // coleta continua mesmo com falha de aplicação
    }
  }
  // coleta de estilo computado prossegue
} finally {
  // limpeza
}
```

**Causa-raiz:** `pseudoApplied = true` é definido ANTES da chamada `forcePseudoState`. Quando a chamada lança exceção, o `catch` registra o erro em `cdpErrors` mas não descarta a amostra nem impede a coleta subsequente. O `finally` executa a limpeza, mas a amostra já foi coletada com base em um estado que pode não ter o pseudoestado aplicado.

**Consequência:** Uma amostra solicitada para `:hover` pode ser produzida sem que o navegador tenha aplicado `:hover`, resultando em medição inválida apresentada como válida.

**Testes atuais relacionados:** C4b verifica que `cleanupStatus === 'success'` após falha na aplicação, mas NÃO verifica se a amostra foi descartada (`discarded === true`). Isso permite que uma amostra inválida passe despercebida.

**Testes ausentes:** P1-P7 da especificação R2.5.3 (aplicação bem-sucedida, falha de aplicação, falha de coleta, falha de limpeza, falha simultânea, ausência de pseudoestado, integração com harness).

### 3.3 Problema 3 — Travessia da raiz do documento

**Trecho atual (core.cjs, linhas 908-911):**
```javascript
if (styleVal.isRoot) {
  // Chegamos à raiz do documento — travessia concluída com sucesso
  break;
}
```

**Causa-raiz:** O `break` ocorre imediatamente após detectar `isRoot`, ANTES que as propriedades `display`, `visibility` e `opacity` do elemento raiz (`html`) sejam processadas. O loop encerra sem acumular a opacidade da raiz nem verificar `display:none`/`visibility:hidden` na raiz.

**Consequência:** `html { opacity: 0 }` não é acumulado na opacidade efetiva do elemento; `html { display: none }` não é detectado; falso positivo de visibilidade para elementos dentro de um `html` oculto ou com opacidade zero.

**Fluxo de execução atual:**
```
elemento → ... → html(isRoot=true) → BREAK (sem ler estilo do html)
```
A opacidade e visibilidade do `html` são completamente ignoradas.

**Testes atuais relacionados:** Nenhum teste da R2.5.2 cobre a raiz do documento com `opacity:0` ou `display:none` no `html`.

**Testes ausentes:** R1-R7 da especificação R2.5.3 (raiz com opacity 1/0/0.5, display:none, visibility:hidden, falha na raiz, travessia normal até raiz).

---

## 4. Correções válidas da R2.5.2 a preservar

| ID | Correção | Arquivo |
|----|----------|---------|
| R25-01 | `sampleId` incorpora `screen` efetivamente | `core.cjs` |
| R25-02 | Contrato de cardinalidade key→nodeId (0/1/>1/erro) | `core.cjs` |
| R25-03 | `try/finally` real com `cleanupStatus` explícito | `core.cjs` |
| R25-04 | Travessia de ancestrais via `DOM.resolveNode` + `Runtime.callFunctionOn` | `core.cjs` |
| R25-05 | Validação numérica explícita de `opacity` (sem `|| 1`) | `core.cjs` |
| R25-06 | Classificação de erros CDP sem falsos positivos textuais | `core.cjs` |
| R25-07 | `makeCDPErrorRecord` preserva `sampleId` e `nodeId` | `core.cjs` |
| R25-08 | Caminhos relativos | `c4-v05-b-r2-5-2.cjs` |
| R25-09 | Limpeza de mutações DOM em `finally` | `c4-v05-b-r2-5-2.cjs` |
| R25-10 | Nenhum fallback a branco presumido | `core.cjs` (`measure()`) |
| R25-11 | Contrato de leitura de ancestrais: completed/partial/unavailable/error/depth-limit/cycle | `c4-v05-b-r2-5-2-core.cjs` |
| R25-12 | `geometryStatus`: available/unavailable/error | `c4-v05-b-r2-5-2-core.cjs` |

---

## 5. Plano de correção para R2.5.3

| Tarefa | Objetivo | Arquivos afetados |
|--------|----------|-------------------|
| T2 | Visibilidade ancestral: não interromper no primeiro `visibility:hidden`/`collapse`; respeitar sobrescrita do descendente; `display:none` continua absoluto | `c4-v05-b-r2-5-3-core.cjs` |
| T3 | Falha de aplicação de pseudoestado invalida a amostra (`discarded = true`, motivo registrado, limpeza preservada) | `c4-v05-b-r2-5-3-core.cjs` |
| T4 | Examinar o elemento raiz antes de encerrar a travessia (opacidade, display, visibility da raiz) | `c4-v05-b-r2-5-3-core.cjs` |
| T5 | Testes de regressão reais (V1-V10, P1-P7, R1-R7) + reprodução dos 114 testes da R2.5.2 | `c4-v05-b-r2-5-3-test.cjs`, `c4-v05-b-r2-5-3-test-fixtures.html` |
| T6 | Execução da suíte controlada e validação de regressões | todos |
| T7 | Evidências, resultados, manifesto de integridade | `c4-v05-b-r2-5-3-integrity.json`, `c4-v05-b-r2-5-3-test.log`, `c4-v05-b-r2-5-3-test-results.json` |
| T8 | Revisão final e relatório técnico | `DIAGNOSTICO-R2-5-3.md`, `RELATORIO-FINAL-R2-5-3.md`, `INDICE-EVIDENCIAS-R2-5-3.md` |

**Não serão iniciadas R2.6 nem R2.7. Nenhum arquivo de produção será alterado. Nenhum arquivo da R2.5.2 será modificado.**

---

## 6. Proposta objetiva de correção

### 6.1 Visibilidade ancestral (T2)
- Remover o `break` ao encontrar ancestral com `visibility:hidden` ou `collapse`.
- Continuar a travessia até a raiz (ou até não conseguir obter o pai), acumulando opacidade de todos os ancestrais e verificando `display:none` em qualquer ancestral.
- A decisão de `visibilityStatus` considera:
  1. `display:none` do próprio elemento → `hidden`.
  2. `visibility:hidden`/`collapse` do próprio elemento (estilo computado, que já reflete herança + sobrescrita) → `hidden`.
  3. `opacity:0` do próprio elemento → `not-visible`.
  4. `display:none` de qualquer ancestral → `hidden` (absoluto, não pode ser sobrescrito).
  5. Opacidade acumulada (próprio × ancestrais) === 0 → `not-visible`.
  6. Caso contrário → `visible` (o `visibility:visible` do descendente sobrescreve o ancestral oculto).
- Falha na leitura de ancestral → `visibilityStatus = 'unknown'` (nunca `visible` quando a leitura falhou e o elemento está visível).

### 6.2 Pseudoestado (T3)
- Quando `CSS.forcePseudoState` (aplicação) falha: registrar erro CDP, definir `discarded = true`, `reason = 'pseudo-apply-error'`, não tratar a coleta posterior como medição válida.
- O `finally` continua executando a limpeza (preservar `try/finally` real).
- `cleanupStatus` reflete o resultado da limpeza (success/failed).
- Falhas simultâneas de aplicação e limpeza: ambos os erros preservados em `cdpErrors`; o erro original de aplicação não é sobrescrito.

### 6.3 Raiz do documento (T4)
- Processar as propriedades do elemento raiz (`display`, `visibility`, `opacity`) ANTES de encerrar a travessia.
- A raiz contribui para a acumulação de opacidade e para a verificação de `display:none`.
- Após examinar a raiz, encerrar com status explícito (`completed`).
- Preservar detecção de ciclo, limite de profundidade, tratamento de falhas e distinção entre completed/partial/unavailable/error.

---

## 7. Decisão

O diagnóstico está concluído. As três falhas funcionais são reais e não podem ser simplesmente sobrescritas. Avançar para a Tarefa 2 (correção da semântica de `visibility`).
