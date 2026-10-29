---
name: auditoria
description: Skill de auditoria de código para o LIVRO-CAIXA. Ajuda a revisar funcionalidades, detectar bugs, riscos de regressão e problemas de segurança sem alterar comportamento existente.
---

# Skill: auditoria

Skill de auditoria e revisão de código para o LIVRO-CAIXA.

## Quando usar

Use quando:
- O usuário pedir para revisar, auditar ou verificar uma área do código
- Antes de alterações de alto risco (financeiro, auth, persistência, SW)
- Para detectar bugs, duplicações ou riscos de regressão
- Para validar que uma alteração não quebra funcionalidades vizinhas

## Regras da auditoria

1. **Não alterar código** — auditoria é somente leitura; propostas vão no relatório
2. **Verificar o estado atual** — o repositório é a fonte de verdade, não documentação antiga
3. **Mapear consumidores** — toda função/ID alterado deve ter seus usos listados
4. **Validar sintaxe** — `node --check` nos arquivos JS revisados
5. **Não inventar problemas** — reportar apenas evidências concretas do código
6. **Classificar severidade** — crítico / alto / médio / baixo / informativo
7. **Preservar dados financeiros** — nunca expor valores reais em logs de auditoria

## Checklist de auditoria

### Estrutura
- [ ] IDs e classes HTML têm consumidores no JS/CSS
- [ ] Funções não são duplicadas em arquivos diferentes
- [ ] Listeners não são duplicados no mesmo elemento
- [ ] Variáveis globais não conflitam com existentes

### Financeiro
- [ ] Cálculos usam a fonte de verdade correta (não cópias)
- [ ] Formatação monetária usa o utilitário `fmt()` existente
- [ ] Datas respeitam timezone e formato persistido
- [ ] Arredondamento consistente com o resto do app

### Persistência
- [ ] Fluxo de salvamento completo (load → mutate → save → render)
- [ ] Proteção contra sobrescrita de dados
- [ ] Compatibilidade retroativa (defaults seguros)

### Segurança
- [ ] Sem secrets/credenciais no código
- [ ] Logs sanitizados (sem tokens, senhas, dados sensíveis)
- [ ] Inputs do usuário escapados (`escapeHTML`)

### UI
- [ ] Responsividade (mobile + desktop)
- [ ] Estados vazio / preenchido / erro
- [ ] Acessibilidade (labels, aria, foco)

## Formato do relatório

```markdown
## Auditoria: <área>

### Arquivos revisados
- `caminho/arquivo.js` (N linhas)

### Achados
| Severidade | Arquivo:Linha | Problema | Sugestão |
|---|---|---|---|
| alto | js/x.js:120 | ... | ... |

### Validações realizadas
- node --check OK
- consumidores mapeados: ...

### Conclusão
<resumo em 2-3 linhas>
```

## Comandos de validação

```bash
# Sintaxe
node --check js/<arquivo>.js

# Consumidores de um ID
grep -rn "getElementById('<id>')" js/

# Consumidores de uma função
grep -rn "<funcao>(" js/

# Diff de uma área específica
git diff -- js/<arquivo>.js style/<arquivo>.css
```
