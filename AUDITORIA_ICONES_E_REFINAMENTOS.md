# Auditoria de ícones e refinamentos visuais — V17-16

A revisão foi feita na cópia independente do Livro-Caixa. O objetivo foi verificar que os grupos de ícones mantêm a mesma linguagem visual sem alterar seus eventos de clique, rótulos ou regras financeiras.

| Grupo | Elementos verificados | Regra aplicada | Resultado |
|---|---|---|---|
| Atalhos da tela Livro-Caixa | Banco, Categoria, Transferência, Colar texto, Importar PDF, exportações e backup | `.quick-action-icon` usa grade centralizada, área fixa e SVG de 19 px com traço consistente | Validado por CSS e prévia móvel |
| Navegação principal | Livro-Caixa, Caixinhas, Investimentos e Perfil | `.nav-icon` usa o mesmo alinhamento, dimensão e espessura de traço; o item ativo é separado pelo indicador Liquid Glass | Validado por smoke test dos quatro destinos e prévias |
| Perfil | Avatar e itens Preferências, Aparência e Segurança | `.profile-avatar svg` e `.profile-item-icon svg` têm dimensões e traços explícitos | Validado por CSS e prévia móvel |
| Ações de edição | Bancos, categorias, rendimentos, investimentos e caixinhas | `.beta-icon-button.edit` mantém 34×34 px, centralização e símbolo de lápis | Validado por inspeção de markup/CSS |
| Ações de exclusão | Bancos, categorias, rendimentos, investimentos e caixinhas | `.beta-icon-button.delete` mantém 34×34 px, cor de risco e estado de foco | Validado por inspeção de markup/CSS |
| Ações de movimentação | Investimentos e caixinhas | `.beta-icon-button.move` usa o mesmo contêiner e área de toque | Validado por inspeção de markup/CSS |
| Ícones financeiros de categorias | Ícones selecionados no catálogo e ícones exibidos nas categorias | A seleção permanece textual/emoji e é escapada antes de inserir conteúdo gerado | Validado por revisão do fluxo de categoria |

## Refinamentos visuais conferidos

A tipografia Plus Jakarta Sans continua sendo a base do sistema. Valores financeiros recebem peso e alinhamento numérico prioritários; descrições longas permanecem dentro das colunas; a ação “Novo lançamento” é a principal; atalhos secundários têm menor peso visual; a barra Liquid Glass permanece flutuante, com safe area e indicador ativo; e as superfícies claro/escuro usam variáveis de tema em vez de uma cor única fixa.

O gráfico de gastos usa o total completo para cálculo. A exibição apresenta seis categorias principais e agrupa o restante em “Outras” quando necessário. Com dez categorias locais, o DOM exibiu sete linhas, incluindo “Outras”, e manteve o total de R$ 2.840,00.

## Limite de confiança

Esta auditoria comprova a camada visual e a preservação dos handlers presentes no arquivo. Ela não substitui a validação autenticada no Firebase, que continua necessária para confirmar dados reais, sincronização offline/online, gráficos alimentados pelo Firestore e importação de PDF em uma sessão real.

## Cards patrimoniais e resumos financeiros

| Card/resumo | Markup e função | Tratamento do ícone | Estado |
|---|---|---|---|
| Patrimônio Total | `.balance-card.total` em `renderBalances()` com `financialIcon('wallet')` | `.balance-symbol` usa 48×48 px no desktop e 43×43 px no mobile; o SVG usa 25 px/22 px e herda a cor do tema. | Padronizado |
| Caixa (Bancos) | `.bank-summary-card` em `renderBalances()` com `financialIcon('bank')` | Ícone de banco em SVG, com superfície verde suave e cor de destaque; o card continua acionável para ver saldos. | Padronizado |
| Investido / Cripto | `.invest-summary-card` em `renderBalances()` com `financialIcon('growth')` | Ícone de crescimento em SVG, usando dourado no tema claro/escuro para diferenciar investimentos. | Padronizado |
| Total investido | `.balance-card.total` em `renderInvestments()` com `financialIcon('growth')` | Reutiliza o símbolo de crescimento e a hierarquia do card total da seção. | Padronizado |
| Total em Caixinhas | `.balance-card.total` em `renderPocketBalances()` com `financialIcon('wallet')` | Reutiliza o símbolo de carteira e o tratamento de destaque da seção. | Padronizado |
| Saldos individuais de caixinhas | `.balance-card` gerado em `renderPocketBalances()` | Não cria um ícone financeiro adicional no markup; usa a estrutura de saldo individual sem ícone, portanto não há um símbolo provisório a normalizar neste bloco. | Sem ícone próprio |

A fonte central dos símbolos é `financialIcon(kind)`, que define os três SVGs `wallet`, `bank` e `growth`. As regras `.balance-symbol` e `.balance-symbol svg`, junto com os overrides claro/escuro e mobile, garantem dimensão, alinhamento, stroke e contraste consistentes.
