# Documentação — LIVRO-CAIXA

Índice de entrada da pasta `docs/`. O **GitHub é a fonte do arquivo**; o Notion mantém o planejamento, as decisões e o histórico complementar. Em caso de divergência entre documento e código, **o código atual prevalece**.

## Finalidade

Esta pasta reúne auditorias, implementações, padrões, referências e especificações de design do LIVRO-CAIXA. A organização é por **função do documento**, não por data, autor ou extensão. Documentos históricos não são apagados: seu recorte temporal é declarado no próprio conteúdo.

## Mapa de áreas

| Área | O que encontro aqui |
|---|---|
| `arquitetura/` | Visão de como componentes e responsabilidades se relacionam (inclui `ia/` histórico) |
| `auditorias/` | Diagnóstico, inspeção, achados, limitações e vereditos — inclui `autenticacao/`, `ia/`, `visual/` e o pacote `c4-v05-b/` (`navegacao/` fica reservada para auditorias futuras) |
| `design-system/` | Especificações, tokens e evolução visual (inclui `auth-overlay/`) |
| `implementacoes/` | O que foi alterado, por quê, em quais arquivos e com quais testes — inclui `autenticacao/`, `ia/`, `navegacao/` e `correcoes/` |
| `padroes/` | Metodologias, contratos e modelos reutilizáveis |
| `referencias/` | Matrizes, inventários e materiais de consulta (inclui `financeiro/`) |

Não existe pasta `historico/`: temporalidade é informação de conteúdo, não de local.

## Documentos

| Documento | Finalidade | Estado temporal | Área |
|---|---|---|---|
| [`arquitetura/ia/AUDITORIA-IA-RESUMO.md`](arquitetura/ia/AUDITORIA-IA-RESUMO.md) | Auditoria cruzada do subsistema de IA | Histórico (01/11/2026; funcionalidade removida) | Arquitetura / IA |
| [`arquitetura/navegacao/ESPECIFICACAO-NAVEGACAO.md`](arquitetura/navegacao/ESPECIFICACAO-NAVEGACAO.md) | Mapa de destinos, aliases, dispatcher, persistência e transições | Proposta derivada de auditoria C.2 — aguardando aceite | Arquitetura / navegação |
| [`auditorias/autenticacao/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md`](auditorias/autenticacao/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md) | Diagnóstico de arquitetura, auth e persistência | Histórico (27/09/2026) | Auditoria / autenticação |
| [`auditorias/ia/AUDITORIA-GROQ-EXCLUSIVA.md`](auditorias/ia/AUDITORIA-GROQ-EXCLUSIVA.md) | Diagnóstico de não exclusividade de provider | Histórico (02/11/2026) | Auditoria / IA |
| [`auditorias/visual/AUDITORIA-VISUAL-MODAIS.md`](auditorias/visual/AUDITORIA-VISUAL-MODAIS.md) | Auditoria visual de modais em desktop | Histórico (19–25/10/2026) | Auditoria / visual |
| [`design-system/DOCUMENTACAO_VARIAVEIS_CSS.md`](design-system/DOCUMENTACAO_VARIAVEIS_CSS.md) | Inventário de tokens e regras de temas | Referência vigente (o código prevalece) | Design system |
| [`design-system/ESPECIFICACAO-VISUAL.md`](design-system/ESPECIFICACAO-VISUAL.md) | Baseline visual por tela/tema/viewport e critérios de aceite | Proposta derivada da C.3 — aguardando aceite | Design system |
| [`design-system/auth-overlay/AUTHOVERLAY-EVOLUCAO-VISUAL.md`](design-system/auth-overlay/AUTHOVERLAY-EVOLUCAO-VISUAL.md) | Histórico e referência visual do AuthOverlay | Histórico/referência (03/11/2026) | Design system |
| [`implementacoes/autenticacao/REFATORACAO-AUTENTICACAO-RELATORIO.md`](implementacoes/autenticacao/REFATORACAO-AUTENTICACAO-RELATORIO.md) | Refatoração do ciclo de autenticação | Histórico (02/11/2026) | Implementação / autenticação |
| [`implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md`](implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md) | Correções e validação da migração Groq | Histórico (02/11/2026) | Implementação / IA |
| [`implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md`](implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md) | Consolidação estrutural da aba Início e divergências D-01 a D-08 | Histórico (`23444f0`); composição vigente em `tmp-c13/c6-*` | Implementação / navegação |
| `tmp-c13/c6-6/RELATORIO-AUDITORIA-C6-INICIO-06.md` | Auditoria/correção da cascata CSS da Início | Corrente (C6-INICIO-06) | Auditoria / CSS |
| `tmp-c13/c6-6/MD-RENOMEAR-MESCLAR.md` | Levantamento de `.md` candidatos a renomeação/consolidação | Proposta — somente leitura | Documentação / manutenção |
| [`implementacoes/correcoes/OPENGOALS_PANEL_FIX_SUMMARY.md`](implementacoes/correcoes/OPENGOALS_PANEL_FIX_SUMMARY.md) | Correção pontual de `openGoalsPanel()` | Histórico (09/11/2026) | Implementação / correções |
| [`referencias/financeiro/COBERTURA-FLUXOS-FINANCEIROS.md`](referencias/financeiro/COBERTURA-FLUXOS-FINANCEIROS.md) | Matriz/taxonomia de fluxos financeiros | Referência histórica (não é cobertura vigente) | Referência / financeiro |
| [`padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md`](padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md) | Metodologia de validação visual com Chromium/CDP | Vigente | Padrões |
| [`padroes/MODELO-RELATORIO-AUDITORIA.md`](padroes/MODELO-RELATORIO-AUDITORIA.md) | Modelo para relatórios técnicos de auditoria | Vigente | Padrões |

### Pacote C.4

[`auditorias/c4-v05-b/`](auditorias/c4-v05-b/) é o pacote histórico de auditoria e evidências C.4 (142 arquivos, 14 diretórios). Permanece no caminho original, com subdiretórios e nomes internos preservados. Para encontrar um artefato específico, começar por [`auditorias/c4-v05-b/INDICE-EVIDENCIAS.md`](auditorias/c4-v05-b/INDICE-EVIDENCIAS.md) e pelos índices de cada rodada. Manifestos `*integrity.json` e os scripts `gerar-*`/`verificar-*` calculam e conferem os hashes. Não alterar por conveniência de organização.

## Como adicionar um documento

1. Escolher a área pela **função**, usando o mapa acima.
2. Usar nome claro e estável; incluir data no nome **somente** quando a data fizer parte da identidade do artefato (ex.: evidências de uma rodada).
3. Declarar no início do documento: recorte temporal (data/branch/commit), classificação (auditoria, implementação, padrão ou referência) e limitações.
4. Não transformar referência ou diagnóstico em relatório de aprovação. Toda conclusão deve apontar para evidência verificável.
5. Adicionar linha neste índice com link relativo, finalidade e estado temporal.
6. Ao mover um arquivo, atualizar **todos** os links relativos e referências em `docs/`, READMEs de raiz, scripts e workflows antes de considerar a mudança concluída.

## Evidências de execução

Os relatórios das fases F0–F6 desta reorganização ficam em `tmp-c13/` (fora de `docs/`) para manter o baseline de 155 arquivos íntegro: `f0-relatorio.md`, `f0-inventario-baseline.json`, `f0-mapeamento-referencias.json` e `f1.1-relatorio.md` a `f1.5-relatorio.md`. O inventário F0 registra os caminhos **anteriores** à movimentação e não deve ser reescrito.
