# Índice de Evidências — C.4-V05-B-R2.5.6

**Correção do contrato de exceções CDP e integração do mecanismo rigoroso de visibilidade**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.6` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `b39ed07f94e2a6d374ca2596f6f020933ed05f3a` |
| Diretório das evidências | `docs/auditorias/c4-v05-b/evidencias-r2-5-6/` |
| Deriva de | `docs/auditorias/c4-v05-b/evidencias-r2-5-5/` |
| Data | 2026-11-15 |
| Commit / push | **Não executados** |

---

## 1. Documentos

| Documento | Caminho | Conteúdo |
|---|---|---|
| Diagnóstico | [`DIAGNOSTICO-R2-5-6.md`](./DIAGNOSTICO-R2-5-6.md) | Causas-raiz com trechos reais, correção do contrato de exceções, remoção da segunda travessia, achado adicional sobre a invalidação de `nodeId` e limitações |
| Relatório final | [`RELATORIO-FINAL-R2-5-6.md`](./RELATORIO-FINAL-R2-5-6.md) | Relatório técnico no Padrão B, com achados, testes, integridade e veredito |
| Índice | `INDICE-EVIDENCIAS-R2-5-6.md` | Este documento |

---

## 2. Artefatos técnicos

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
|---|---|---|---|---|---|
| Núcleo R2.5.6 | `c4-v05-b-r2-5-6-core.cjs` | no manifesto | no manifesto | no manifesto | Núcleo compartilhado: contrato de exceções e exposição de `traverseAncestorChain` |
| Harness R2.5.6 | `c4-v05-b-r2-5-6.cjs` | no manifesto | no manifesto | no manifesto | Coleta principal integrada ao mecanismo do núcleo |
| Testes R2.5.6 | `c4-v05-b-r2-5-6-test.cjs` | no manifesto | no manifesto | no manifesto | Suíte: 309 asserções herdadas + 51 novas (X1–X4, Y1–Y5) |
| Fixture R2.5.6 | `c4-v05-b-r2-5-6-test-fixtures.html` | no manifesto | no manifesto | no manifesto | Alvos de exceção real e consumidores de `--accent` |
| Log de execução | `c4-v05-b-r2-5-6-test.log` | no manifesto | no manifesto | no manifesto | Log textual das 360 asserções |
| Resultados JSON | `c4-v05-b-r2-5-6-test-results.json` | no manifesto | no manifesto | no manifesto | 360 registros individuais e contagens recalculadas |
| Gerador de resultados | `gerar-resultados-r2-5-6.cjs` | no manifesto | no manifesto | no manifesto | Consolida o log; detecta duplicidades e linhas não parseadas |
| Gerador de manifesto | `gerar-manifesto-r2-5-6.cjs` | no manifesto | no manifesto | no manifesto | Gera o manifesto após o último artefato |
| Verificador de manifesto | `verificar-manifesto-r2-5-6.cjs` | no manifesto | no manifesto | no manifesto | Recálculo independente, sem reutilizar a rotina geradora |
| Diagnóstico | `DIAGNOSTICO-R2-5-6.md` | no manifesto | no manifesto | no manifesto | Documento |
| Índice | `INDICE-EVIDENCIAS-R2-5-6.md` | no manifesto | no manifesto | no manifesto | Este documento |
| Relatório final | `RELATORIO-FINAL-R2-5-6.md` | no manifesto | no manifesto | no manifesto | Documento |
| Manifesto de integridade | `c4-v05-b-r2-5-6-integrity.json` | gerado por último | — | — | SHA-256 de 12 artefatos; sem auto-referência |

**Sobre a ausência de hashes nesta tabela.** O manifesto `c4-v05-b-r2-5-6-integrity.json` é a fonte única dos hashes e é gerado por último. Ele **não** declara o próprio hash e **não** é referenciado por hash aqui, para evitar a circularidade que produziu a divergência A-05 na R2.5.3.

---

## 3. Resultados

| Métrica | Valor |
|---|---|
| Registros individuais (asserções) | 360 |
| Identificadores distintos | 124 |
| PASS | 359 |
| FAIL | 0 |
| BLOCKED | 1 |
| NOT RUN | 0 |
| `summaryMatchesLog` | `true` |
| `groupsMatchSummary` | `true` |
| Duplicidades de identificador | 0 |
| Linhas não parseadas | 0 |
| Herança R2.5.5 | 309 de 309 asserções presentes e aprovadas |
| Asserções novas | 51 (51 PASS) |

**Grupos:** A:16 · B:17 · C:21 · D:27 · V:164 · P:19 · R:12 · E:7 · F:11 · G:11 · H:4 · **X:21** · **Y:30**

**Grupo X — contrato de exceções CDP com exceção real no Chromium**

| ID | PASS | FAIL | BLOCKED | Objetivo |
|---|---|---|---|---|
| X1 | 7 | 0 | 0 | `exceptionDetails` na leitura do pai → `error` |
| X2 | 5 | 0 | 0 | Opacidade zero preservada antes da exceção real |
| X3 | 6 | 0 | 0 | Evidência de ocultação preservada antes da exceção |
| X4 | 3 | 0 | 0 | Distinção entre exceção no navegador e rejeição no cliente |

**Grupo Y — integração da coleta principal com o núcleo**

| ID | PASS | FAIL | BLOCKED | Objetivo |
|---|---|---|---|---|
| Y1 | 13 | 0 | 0 | Descoberta, associação e linha final pelo fluxo real do harness |
| Y2 | 4 | 0 | 0 | Ancestral com opacidade zero → `not-visible` |
| Y3 | 3 | 0 | 0 | Travessia incompleta → nunca `visible` |
| Y4 | 7 | 0 | 0 | Associação inválida → estado indisponível e causa explícita |
| Y5 | 3 | 0 | 0 | Todas as associações do lote permanecem utilizáveis |

**Único item não aprovado — V32 (BLOCKED).** A distribuição real de um elemento por `<slot>` não é observável neste ambiente: `element.assignedSlot` permanece `null` e `slot.assignedNodes()` retorna lista vazia no Chromium 156.0.8078.79 (build Termux/Android), inclusive no caso canônico de um slot padrão com um único filho. O teste está registrado como `BLOCKED`, com causa específica, e nunca como `PASS`. **V32b** é evidência da *precedência* da regra implementada, e **não** da distribuição real.

---

## 4. Reprodução

```bash
# 1. Servir a fixture
python3 -m http.server 8000 --bind 127.0.0.1

# 2. Chromium headless com CDP
chromium-browser --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --user-data-dir=/tmp/c4-profile &

# 3. Suíte integral
cd docs/auditorias/c4-v05-b/evidencias-r2-5-6
node c4-v05-b-r2-5-6-test.cjs

# 4. Registros individuais e contagens recalculadas
node gerar-resultados-r2-5-6.cjs

# 5. Manifesto (por último) e verificação independente
node gerar-manifesto-r2-5-6.cjs
node verificar-manifesto-r2-5-6.cjs
```

O verificador sai com código 0 quando todos os artefatos declarados conferem no recálculo e com código 1 caso contrário. Ele grava no manifesto o resultado **observado** (`allHashesMatch`, `filesVerified`, `filesAltered`, `filesMissing`, `verifiedAt`), que permanece `null` enquanto a verificação não tiver sido executada.

---

## 5. Escopo e integridade

- **Nenhum arquivo de produção alterado** — `index.html`, `js/`, `style/`, CSS, tokens, temas e componentes intactos.
- **R2.5.3, R2.5.4 e R2.5.5 preservadas intactas** — verificado por `git diff HEAD -- evidencias-r2-5-3/ evidencias-r2-5-4/ evidencias-r2-5-5/`, sem diferenças.
- **Nenhum commit e nenhum push** executados para a R2.5.6.
- **Coleta completa de consumidores `--accent` não executada** — fora do escopo.
- **R2.6 e R2.7 não iniciadas.**
- **Veredito registrado:** aprovada na **validação interna**. A aprovação da R2.5.6 depende da auditoria independente do ChatGPT.

---

## 6. Referências

- Modelo de relatório: [`../../../../padroes/MODELO-RELATORIO-AUDITORIA.md`](../../../../padroes/MODELO-RELATORIO-AUDITORIA.md)
- Regras de engenharia: [`../../../../AGENTS.md`](../../../../AGENTS.md)
- Diagnóstico da R2.5.5 (base desta etapa): [`../evidencias-r2-5-5/DIAGNOSTICO-R2-5-5.md`](../evidencias-r2-5-5/DIAGNOSTICO-R2-5-5.md)
- Relatório da R2.5.5: [`../evidencias-r2-5-5/RELATORIO-FINAL-R2-5-5.md`](../evidencias-r2-5-5/RELATORIO-FINAL-R2-5-5.md)
