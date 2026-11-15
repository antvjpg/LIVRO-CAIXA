# RELATÓRIO TÉCNICO DE AUDITORIA

> **Modelo reutilizável.** Este documento é um template, não um relatório preenchido. Não contém dados fictícios, hashes, resultados ou métricas inventadas. Campos que não se aplicam à auditoria em questão devem ser preenchidos com `N/A` e, quando relevante, justificados.

---

## 1. Identificação

- **Auditoria:**
- **Data:**
- **Repositório:**
- **Branch:**
- **Commit-base:**
- **Commit examinado:**
- **Responsável pela execução:**
- **Estado do working tree:**

---

## 2. Objetivo e escopo

- **Objetivo:**
- **Escopo:**
- **Fora do escopo:**
- **Critérios de aprovação:**

---

## 3. Metodologia

- **Estratégia de investigação:**
- **Ferramentas utilizadas:**
- **Arquivos examinados:**
- **Procedimentos executados:**
- **Limitações metodológicas:**

---

## 4. Inventário de evidências

Para cada evidência:

- **Identificador:**
- **Arquivo:**
- **Finalidade:**
- **Origem:**
- **Integridade:**
- **Verificação realizada:**

---

## 5. Achados

Para cada achado:

- **ID:**
- **Título:**
- **Gravidade:**
- **Localização:**
- **Problema observado:**
- **Causa-raiz:**
- **Impacto:**
- **Evidência:**
- **Reprodução:**
- **Correção recomendada:**
- **Critério de encerramento:**

---

## 6. Testes e verificações

Para cada teste:

- **ID:**
- **Objetivo:**
- **Pré-condições:**
- **Procedimento:**
- **Resultado esperado:**
- **Resultado observado:**
- **Status:**
- **Evidência:**

**Estados válidos de status:** `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.

Regras de contagem:
- Teste não executado nunca é contabilizado como aprovado (`NOT RUN` nunca vira `PASS`).
- Teste bloqueado não é apresentado como sucesso (`BLOCKED` nunca vira `PASS`).
- Resultado esperado não é apresentado como resultado observado.

---

## 7. Consistência e integridade

- **Contagens:**
- **Divergências:**
- **Hashes:**
- **Manifestos:**
- **Logs:**
- **Verificações independentes:**

Regras:
- As contagens de PASS/FAIL/BLOCKED/NOT RUN devem ser derivadas dos registros individuais, não informadas manualmente.
- Divergências entre log, JSON, manifesto, índice e relatório devem ser explicitadas, não omitidas.
- Não escolher arbitrariamente a contagem mais favorável.
- Não omitir falhas para produzir um relatório aparentemente positivo.

---

## 8. Limitações e incertezas

- **Itens não verificados:**
- **Testes bloqueados:**
- **Testes não executados:**
- **Incertezas:**
- **Dependências externas:**

---

## 9. Veredito

- **APROVADA / REPROVADA / INCONCLUSIVA:**
- **Fundamentação:**
- **Critérios atendidos:**
- **Critérios não atendidos:**
- **Condições para nova avaliação:**

---

## 10. Próximos passos

- **Correções necessárias:**
- **Evidências adicionais:**
- **Próxima etapa autorizada:**

---

## Regras gerais de uso deste modelo

1. Este modelo se aplica a auditorias de arquitetura, segurança, testes, integridade, harnesses e validações especializadas. Para tarefas gerais de desenvolvimento, usar o Padrão A — Relatório de implementação, definido na seção 53 do `AGENTS.md`.
2. O modelo deve ser utilizável sem exigir preenchimento artificial: registrar `N/A` quando um item não se aplica.
3. Todo relatório deve distinguir fato observado, interpretação, hipótese, resultado esperado, resultado observado e item não verificado (seção 60 do `AGENTS.md`).
4. Não duplicar conteúdos já existentes no `AGENTS.md`; referenciar em vez de copiar.
5. Toda afirmação técnica relevante deve possuir evidência verificável.
6. O agente que executa a implementação não pode declarar que uma auditoria independente foi aprovada com base apenas em seus próprios testes. A aprovação independente depende de verificação efetiva por terceiro (seção 61 do `AGENTS.md`).

---

## Histórico de uso

| Data | Auditoria | Commit-base | Veredito | Responsável |
|---|---|---|---|---|
