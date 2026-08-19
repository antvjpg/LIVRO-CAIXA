# Validação visual preliminar — V17-16 independente

## Viewport testada

As prévias foram renderizadas em 390×844 px, em modo claro e em modo escuro, usando uma cópia temporária do HTML independente com a autenticação ocultada apenas para inspeção estrutural.

## Achados

| Área | Modo claro | Modo escuro |
|---|---|---|
| Cabeçalho | Mantém contraste forte, título legível e controles de menu, notificações e tema acessíveis. | Mantém profundidade e contraste; os controles permanecem identificáveis. |
| Ação principal | “Novo lançamento” domina visualmente sem aumentar excessivamente o restante da interface. | O dourado da paleta 1 cria separação clara entre ação principal e fundo. |
| Ações secundárias | Grade organizada em três colunas, com áreas de toque amplas e ícones alinhados. | Superfícies têm níveis de profundidade distinguíveis sem brilho excessivo. |
| Lançamentos | O cartão aparece separado e com o botão de filtros acessível, sem overflow horizontal. | O cartão permanece legível, com borda discreta e contraste adequado. |
| Navegação | Barra inferior flutuante respeita a área inferior e mostra o item Livro-Caixa ativo. | O indicador ativo mantém contraste e a barra continua separada do fundo. |

## Observação de teste

A prévia estrutural não carrega dados financeiros porque a autenticação Firebase não é simulada. Portanto, ela valida layout, temas, espaçamentos, hierarquia e navegação estática; os fluxos autenticados, importação, persistência, gráficos e edição ainda precisam ser testados separadamente antes da entrega.

## Revalidação após ajuste do rodapé

As prévias finais continuam sem estouro horizontal e mantêm a hierarquia do cabeçalho, da ação principal, da grade de ações e da navegação. O texto de sincronização passou a quebrar dentro da largura disponível; no recorte de 390 px ele permanece visualmente secundário e não invade a barra inferior. O modo escuro preserva a separação entre fundo, superfícies intermediárias, ação principal dourada e indicador ativo.

A validação visual está aprovada para avançar aos testes de sintaxe, estrutura e fluxos. Ainda não representa validação autenticada do Firestore.

## Testes estáticos e smoke test

- Sintaxe do JavaScript inline: aprovada com `node --check`.
- Sintaxe do `sw.js`: aprovada com `node --check`.
- Manifesto PWA: JSON e referência de ícones presentes.
- Proteção do fluxo Colar texto: `pastePreviewInProgress` desabilita o botão durante a geração da prévia e é liberado em `finally`.
- PDF: limite de 12 MB e limite de 80 páginas presentes no código; o fluxo usa PDF.js e separa a geração da prévia da confirmação.
- Navegação: Perfil fica ativo e o `balanceStrip` é ocultado fora da aba Livro-Caixa no smoke test.
- Colagem: uma linha `18/08/2026 Sorvete -10,00` gerou uma prévia com uma linha identificada e pronta.
- Modal de categorias em viewport móvel: `DOC=500;VIEW=500;PANEL=466;PANELCLIENT=466;BODYOVERFLOWX=hidden` na medição headless, sem largura adicional causada pelo documento.

## Limite de validação atual

Os testes foram executados sem uma sessão Firebase autenticada, portanto não confirmam leitura/escrita real no Firestore, autenticação de produção, cotação externa ou persistência offline. A versão ainda não deve ser considerada uma entrega final de produção até que esses fluxos sejam testados em uma sessão real.

## Validação adicional de modal e navegação

A prévia do modal de categorias com 18 itens mostrou o cabeçalho, os campos e os controles de edição/exclusão dentro da largura disponível, enquanto a lista permanece rolável e o botão Adicionar fica isolado no rodapé. Não houve sobreposição com a barra inferior.

A prévia do destino Investimentos confirmou que o conteúdo muda para a seção correta e que o indicador ativo da barra Liquid Glass acompanha o terceiro destino, sem permanecer visualmente no Livro-Caixa. O mesmo estado é aplicado por `data-active` para Caixinhas e Perfil.

## Auditoria visual do gráfico

A função de resumo agora mantém o total calculado sobre todas as categorias, apresenta individualmente as seis maiores e agrega as demais em uma categoria de exibição chamada “Outras” quando há mais de sete categorias. A legenda continua usando as colunas Categoria, Valor e %, sem truncar nomes por CSS. A validação com dez categorias locais confirmou que o código de agregação é isolado da persistência e não altera lançamentos nem valores armazenados.

A captura inicial em 390 px mostra a primeira viewport; a seção de gráfico fica abaixo do recorte por causa da navegação e das ações, portanto a confirmação visual da legenda deve ser feita com rolagem dentro do navegador ou em uma captura de página completa real. O relatório não considera a captura de dados locais como dados financeiros reais.

A validação dentro do escopo real de inicialização confirmou o agrupamento: com dez categorias locais, o DOM exibiu `hasOthers=true`, `rowCount=7` e `Total de gastos R$ 2.840,00`, preservando a soma das dez categorias e apresentando seis categorias mais “Outras”.

## Comprovação visual rolada do gráfico

A captura rolada da seção completa em 390 px mostrou as sete linhas da legenda: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação e Outras. Cada linha exibiu nome, valor e percentual na mesma grade, sem corte horizontal ou quebra inadequada. A captura inferior confirmou o gráfico de rosca, a mesma legenda e o respiro da seção; o total calculado permanece no bloco inferior da seção, fora do recorte parcial usado para preservar a leitura da legenda.
