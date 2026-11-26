# Classificação e pontuação — v1.1.0

## Finalidade

A classificação existe para orientar investigação, não para aprovar ou reprovar uma interface automaticamente.

## Campos independentes

### severity

- `P0`: problema confirmado, crítico, com risco de acessibilidade, segurança, integridade ou funcionamento.
- `P1`: problema confirmado com impacto alto em acessibilidade, usabilidade ou compreensão.
- `P2`: melhoria recomendada ou candidato de manutenção.
- `INFO`: observação contextual.

Uma heurística estática nunca gera `P0` ou `P1`.

### confidence

- `high`: a existência do sinal é diretamente observável no código.
- `medium`: o sinal existe, mas escopo, cascata ou intenção são parciais.
- `low`: há indício, mas contexto insuficiente.

Confiança na existência de uma declaração não equivale a confiança de que ela seja um defeito.

### status

- `confirmed`: evidência suficiente de problema real.
- `candidate`: sinal encontrado; requer revisão.
- `inconclusive`: há indício, mas falta evidência.
- `false_positive`: contexto identificado como legítimo.
- `unsupported`: regra requer análise renderizada.

## Códigos de saída

| Código | Significado |
|---:|---|
| 0 | Auditoria concluída; candidatos podem permanecer. |
| 1 | Erro de execução, configuração ou inconsistência documental. |
| 2 | Achado confirmado P0/P1. |

O detector v1.1.0 não produz P0/P1 confirmados. Portanto, seu uso normal termina com código 0 mesmo quando há candidatos.

## Slop Index

O Slop Index da v1.0.0 foi desativado como critério de aprovação.

Motivos:

- depende de contagem de padrões em arquivos globais;
- não avalia contraste;
- trata escolhas de design system como sinais negativos;
- não separa candidatos de defeitos;
- pode incentivar remoção de recursos legítimos apenas para reduzir a nota.

Resultados históricos permanecem nos relatórios antigos, mas não devem ser usados como gate da v1.1.0.

## Regras de elevação

Uma regra só pode ser elevada a P1/P2 confirmado quando houver evidência de uma das seguintes fontes:

- teste de teclado;
- medição de contraste;
- medição de alvo de toque;
- observação de comportamento renderizado;
- violação funcional reproduzível;
- contradição direta com requisito aprovado do produto.

Preferir um relatório com poucos achados comprovados a muitos alertas heurísticos.
