# Índice de Evidências — C.4-V05-B-R2.5.5

**Mecanismo rigoroso de visibilidade e integridade da travessia**

| Campo | Valor |
|---|---|
| Versão de trabalho | `C.4-V05-B-R2.5.5` |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `6bbffe70baf112983c5bed009ec0c4bcce04494e` |
| Diretório das evidências | `docs/auditorias/c4-v05-b/evidencias-r2-5-5/` |
| Deriva de | `docs/auditorias/c4-v05-b/evidencias-r2-5-4/` |
| Data | 2026-11-15 |
| Commit / push | **Não executados** |

---

## 1. Documentos

| Documento | Caminho | Conteúdo |
|---|---|---|
| Diagnóstico | [`DIAGNOSTICO-R2-5-5.md`](./DIAGNOSTICO-R2-5-5.md) | Defeitos confirmados com trechos reais, achado adicional sobre detecção de ciclo, decisões de semântica e limitações |
| Relatório final | [`RELATORIO-FINAL-R2-5-5.md`](./RELATORIO-FINAL-R2-5-5.md) | Relatório técnico no Padrão B, com achados, testes, integridade e veredito |
| Índice | `INDICE-EVIDENCIAS-R2-5-5.md` | Este documento |

---

## 2. Artefatos técnicos

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
|---|---|---|---|---|---|
| Núcleo R2.5.5 | `c4-v05-b-r2-5-5-core.cjs` | no manifesto | no manifesto | no manifesto | Núcleo compartilhado com o mecanismo de visibilidade R25.5 |
| Harness R2.5.5 | `c4-v05-b-r2-5-5.cjs` | no manifesto | no manifesto | no manifesto | Harness de execução (não executa coleta completa) |
| Testes R2.5.5 | `c4-v05-b-r2-5-5-test.cjs` | no manifesto | no manifesto | no manifesto | Suíte controlada: 170 asserções herdadas + 139 novas (V14–V38) |
| Fixture R2.5.5 | `c4-v05-b-r2-5-5-test-fixtures.html` | no manifesto | no manifesto | no manifesto | Shadow DOM real, cadeias de 47/48/49 níveis, ciclo real |
| Log de execução | `c4-v05-b-r2-5-5-test.log` | no manifesto | no manifesto | no manifesto | Log textual das 309 asserções |
| Resultados JSON | `c4-v05-b-r2-5-5-test-results.json` | no manifesto | no manifesto | no manifesto | 309 registros individuais e contagens recalculadas |
| Gerador de resultados | `gerar-resultados-r2-5-5.cjs` | no manifesto | no manifesto | no manifesto | Consolida o log; detecta duplicidades e linhas não parseadas |
| Gerador de manifesto | `gerar-manifesto-r2-5-5.cjs` | no manifesto | no manifesto | no manifesto | Gera o manifesto após o último artefato |
| Verificador de manifesto | `verificar-manifesto-r2-5-5.cjs` | no manifesto | no manifesto | no manifesto | Recálculo independente, sem reutilizar a rotina geradora |
| Diagnóstico | `DIAGNOSTICO-R2-5-5.md` | no manifesto | no manifesto | no manifesto | Documento |
| Índice | `INDICE-EVIDENCIAS-R2-5-5.md` | no manifesto | no manifesto | no manifesto | Este documento |
| Relatório final | `RELATORIO-FINAL-R2-5-5.md` | no manifesto | no manifesto | no manifesto | Documento |
| Manifesto de integridade | `c4-v05-b-r2-5-5-integrity.json` | gerado por último | — | — | SHA-256 de 12 artefatos; sem auto-referência |

**Sobre a ausência de hashes nesta tabela.** O manifesto `c4-v05-b-r2-5-5-integrity.json` é a fonte única dos hashes e é gerado por último. Ele **não** declara o próprio hash e **não** é referenciado por hash aqui, para evitar a circularidade que produziu a divergência A-05 na R2.5.3 (manifesto com `allHashesMatch: true` e 2 de 9 artefatos divergentes no recálculo).

---

## 3. Resultados

| Métrica | Valor |
|---|---|
| Registros individuais | 309 |
| PASS | 308 |
| FAIL | 0 |
| BLOCKED | 1 |
| NOT RUN | 0 |
| `summaryMatchesLog` | `true` |
| `groupsMatchSummary` | `true` |
| Duplicidades de identificador | 0 |
| Linhas não parseadas | 0 |
| Herança R2.5.4 | 170 de 170 asserções presentes e aprovadas |

**Grupos:** A:16 · B:17 · C:21 · D:27 · V:164 · P:19 · R:12 · E:7 · F:11 · G:11 · H:4

**Único item não aprovado — V32 (BLOCKED).** A distribuição real de um elemento por `<slot>` não é observável neste ambiente: `element.assignedSlot` permanece `null` e `slot.assignedNodes()` retorna lista vazia no Chromium 156.0.8078.79 (build Termux/Android), inclusive no caso canônico de um slot padrão com um único filho. O teste está registrado como `BLOCKED`, com causa específica, e nunca como `PASS`. A **precedência** `assignedSlot` → `parentElement` → host, implementada no núcleo, é verificada pelo teste V32b, que observa opacidade acumulada de `0.5` (a do slot) contra `1` (a do pai).

---

## 4. Reprodução

```bash
# 1. Servir a fixture
python3 -m http.server 8000 --bind 127.0.0.1

# 2. Chromium headless com CDP
chromium-browser --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --user-data-dir=/tmp/c4-profile &

# 3. Suíte integral
cd docs/auditorias/c4-v05-b/evidencias-r2-5-5
node c4-v05-b-r2-5-5-test.cjs

# 4. Registros individuais e contagens recalculadas
node gerar-resultados-r2-5-5.cjs

# 5. Manifesto (por último) e verificação independente
node gerar-manifesto-r2-5-5.cjs
node verificar-manifesto-r2-5-5.cjs
```

O verificador sai com código 0 quando todos os artefatos declarados conferem no recálculo e com código 1 caso contrário. Ele grava no manifesto o resultado **observado** (`allHashesMatch`, `filesVerified`, `filesAltered`, `filesMissing`, `verifiedAt`), que permanece `null` enquanto a verificação não tiver sido executada.

---

## 5. Escopo e integridade

- **Nenhum arquivo de produção alterado** — `index.html`, `js/`, `style/` e CSS de produção intactos.
- **R2.5.3 e R2.5.4 preservadas intactas** — verificado por `git diff HEAD -- evidencias-r2-5-3/ evidencias-r2-5-4/`, sem diferenças.
- **Nenhum commit e nenhum push** executados para a R2.5.5.
- **R2.6 e R2.7 não iniciadas.**
- **Veredito registrado:** aprovada na **validação interna**. A aprovação da R2.5.5 depende da auditoria independente do ChatGPT.

---

## 6. Referências

- Modelo de relatório: [`../../../../padroes/MODELO-RELATORIO-AUDITORIA.md`](../../../../padroes/MODELO-RELATORIO-AUDITORIA.md)
- Regras de engenharia: [`../../../../AGENTS.md`](../../../../AGENTS.md)
- Diagnóstico R2.5.3 (base da auditoria que motivou esta etapa): [`../DIAGNOSTICO-R2-5-3.md`](../DIAGNOSTICO-R2-5-3.md)
- Relatório da R2.5.4: [`../evidencias-r2-5-4/RELATORIO-FINAL-R2-5-4.md`](../evidencias-r2-5-4/RELATORIO-FINAL-R2-5-4.md)
