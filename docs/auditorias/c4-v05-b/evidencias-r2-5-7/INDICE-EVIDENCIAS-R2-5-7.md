# Índice de Evidências — C.4-V05-B-R2.5.7

**Correção de colisão de identificadores entre execuções da coleta (F-04)**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.7` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `a790d61612566185d42d24a9d1678faa7f466cf9` |
| Diretório das evidências | `docs/auditorias/c4-v05-b/evidencias-r2-5-7/` |
| Deriva de | `docs/auditorias/c4-v05-b/evidencias-r2-5-6/` |
| Núcleo compartilhado | **Não alterado** — consome o núcleo publicado na R2.5.6 |
| Data | 2026-11-15 |
| Commit / push | Concluídos — `ad9188964b5c5a68e380c77af95c8f688fd1dec2` |

---

## 1. Documentos

| Documento | Caminho | Conteúdo |
|---|---|---|
| Diagnóstico | [`DIAGNOSTICO-R2-5-7.md`](./DIAGNOSTICO-R2-5-7.md) | F-04 com trechos reais, alternativas descartadas, correção e limitações |
| Relatório final | [`RELATORIO-FINAL-R2-5-7.md`](./RELATORIO-FINAL-R2-5-7.md) | Relatório técnico no Padrão B, com achados, testes, integridade e veredito |
| Índice | `INDICE-EVIDENCIAS-R2-5-7.md` | Este documento |

---

## 2. Artefatos técnicos

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
|---|---|---|---|---|---|
| Harness R2.5.7 | `c4-v05-b-r2-5-7.cjs` | no manifesto | no manifesto | no manifesto | Coleta com identidade por execução (F-04) |
| Testes R2.5.7 | `c4-v05-b-r2-5-7-test.cjs` | no manifesto | no manifesto | no manifesto | Suíte: 360 asserções herdadas + 33 novas (Z1–Z10) |
| Fixture R2.5.7 | `c4-v05-b-r2-5-7-test-fixtures.html` | no manifesto | no manifesto | no manifesto | Cópia da R2.5.6; as views do grupo Z são criadas em tempo de execução |
| Log de execução | `c4-v05-b-r2-5-7-test.log` | no manifesto | no manifesto | no manifesto | Log textual das 393 asserções |
| Resultados JSON | `c4-v05-b-r2-5-7-test-results.json` | no manifesto | no manifesto | no manifesto | 393 registros individuais e contagens recalculadas |
| Gerador de resultados | `gerar-resultados-r2-5-7.cjs` | no manifesto | no manifesto | no manifesto | Consolida o log; detecta duplicidades e linhas não parseadas |
| Gerador de manifesto | `gerar-manifesto-r2-5-7.cjs` | no manifesto | no manifesto | no manifesto | Gera o manifesto após o último artefato |
| Verificador de manifesto | `verificar-manifesto-r2-5-7.cjs` | no manifesto | no manifesto | no manifesto | Recálculo independente, sem reutilizar a rotina geradora |
| Diagnóstico | `DIAGNOSTICO-R2-5-7.md` | no manifesto | no manifesto | no manifesto | Documento |
| Índice | `INDICE-EVIDENCIAS-R2-5-7.md` | no manifesto | no manifesto | no manifesto | Este documento |
| Relatório final | `RELATORIO-FINAL-R2-5-7.md` | no manifesto | no manifesto | no manifesto | Documento |
| Manifesto de integridade | `c4-v05-b-r2-5-7-integrity.json` | gerado por último | — | — | SHA-256 de 11 artefatos; sem auto-referência |

**Sobre a ausência do núcleo.** O núcleo compartilhado **não** foi alterado nesta rodada. A R2.5.7 **não** o copia: harness e suíte consomem `../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs`. O hash do núcleo em uso está no manifesto da R2.5.6 (`c4-v05-b-r2-5-6-integrity.json`, 12/12 conformes), que permanece intacto.

**Sobre a ausência de hashes nesta tabela.** O manifesto `c4-v05-b-r2-5-7-integrity.json` é a fonte única dos hashes e é gerado por último. Ele **não** declara o próprio hash e **não** é referenciado por hash aqui, para evitar a circularidade que produziu a divergência A-05 na R2.5.3.

---

## 3. Resultados

| Métrica | Valor |
|---|---|
| Registros individuais (asserções) | 393 |
| Identificadores distintos | 134 |
| PASS | 392 |
| FAIL | 0 |
| BLOCKED | 1 |
| NOT RUN | 0 |
| Duplicidades de identificador | 0 |
| Duplicidades de par `(id, nome)` | 0 |
| `summaryMatchesLog` | `true` |
| `groupsMatchSummary` | `true` |
| Linhas não parseadas | 0 |
| Herança R2.5.6 | 360 de 360 asserções presentes e aprovadas |
| Asserções novas | 33 (33 PASS) |

**Grupos:** A:16 · B:17 · C:21 · D:27 · V:164 · P:19 · R:12 · E:7 · F:11 · G:11 · H:4 · X:21 · Y:30 · **Z:33**

**Grupo Z — identidade de execução da coleta (F-04)**

| ID | PASS | FAIL | BLOCKED | Objetivo |
|---|---|---|---|---|
| Z1 | 3 | 0 | 0 | Reprodução de F-04 pelo caminho real de resolução |
| Z2 | 4 | 0 | 0 | Identificadores distintos e monotônicos; nenhuma chave reutilizada |
| Z3 | 5 | 0 | 0 | Elementos antigos não contaminam a resolução atual |
| Z4 | 6 | 0 | 0 | Três execuções sucessivas sem colisão |
| Z5 | 4 | 0 | 0 | View anterior oculta e ainda montada |
| Z6 | 2 | 0 | 0 | Negativo: chave inexistente |
| Z7 | 2 | 0 | 0 | Negativo: chave duplicada na execução atual |
| Z8 | 3 | 0 | 0 | Negativo: chave antiga de outra execução |
| Z9 | 3 | 0 | 0 | Negativo: erro CDP na resolução |
| Z10 | 1 | 0 | 0 | Negativo: resolução sem identificador de execução |

**Único item não aprovado — V32 (BLOCKED).** A distribuição real de um elemento por `<slot>` não é observável neste ambiente: `element.assignedSlot` permanece `null` e `slot.assignedNodes()` retorna lista vazia no Chromium 156.0.8078.79 (build Termux/Android), inclusive no caso canônico. O teste está registrado como `BLOCKED`, com causa específica, e nunca como `PASS`. **V32b** continua sendo evidência da *precedência* da regra, e **não** da distribuição real.

---

## 4. Reprodução

```bash
# 1. Servir a fixture
python3 -m http.server 8000 --bind 127.0.0.1

# 2. Chromium headless com CDP
chromium-browser --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --user-data-dir=/tmp/c4-profile &

# 3. Suíte integral
cd docs/auditorias/c4-v05-b/evidencias-r2-5-7
node c4-v05-b-r2-5-7-test.cjs

# 4. Registros individuais e contagens recalculadas
node gerar-resultados-r2-5-7.cjs

# 5. Manifesto (por último) e verificação independente
node gerar-manifesto-r2-5-7.cjs
node verificar-manifesto-r2-5-7.cjs
```

O verificador sai com código 0 quando todos os artefatos declarados conferem no recálculo e com código 1 caso contrário. Ele grava no manifesto o resultado **observado** (`allHashesMatch`, `filesVerified`, `filesAltered`, `filesMissing`, `verifiedAt`), que permanece `null` enquanto a verificação não tiver sido executada.

---

## 5. Escopo e integridade

- **Nenhum arquivo de produção alterado** — `index.html`, `js/`, `style/`, CSS, HTML funcional e regras financeiras intactos.
- **Núcleo compartilhado não alterado** — a R2.5.7 consome o núcleo publicado na R2.5.6, sem cópia.
- **R2.5.3, R2.5.4, R2.5.5 e R2.5.6 preservadas intactas** — verificado por `git diff HEAD -- evidencias-r2-5-3/ evidencias-r2-5-4/ evidencias-r2-5-5/ evidencias-r2-5-6/`, sem diferenças.
- **Commit e push concluídos** — `ad9188964b5c5a68e380c77af95c8f688fd1dec2`; ver a retificação pós-publicação em `RELATORIO-FINAL-R2-5-7.md`, seção 10.
- **Coleta completa de consumidores `--accent` não executada** — fora do escopo.
- **Mecanismo de travessia, F-03 e `backendNodeId` não foram tocados.**
- **R2.6 e R2.7 não iniciadas.**
- **Veredito registrado:** aprovada na **validação interna**. A aprovação da R2.5.7 depende da auditoria independente do ChatGPT.

---

## 6. Referências

- Modelo de relatório: [`../../../../padroes/MODELO-RELATORIO-AUDITORIA.md`](../../../../padroes/MODELO-RELATORIO-AUDITORIA.md)
- Regras de engenharia: [`../../../../AGENTS.md`](../../../../AGENTS.md)
- Diagnóstico da R2.5.6 (base desta etapa): [`../evidencias-r2-5-6/DIAGNOSTICO-R2-5-6.md`](../evidencias-r2-5-6/DIAGNOSTICO-R2-5-6.md)
- Relatório da R2.5.6: [`../evidencias-r2-5-6/RELATORIO-FINAL-R2-5-6.md`](../evidencias-r2-5-6/RELATORIO-FINAL-R2-5-6.md)
- Núcleo em uso (inalterado): [`../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs`](../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs)
