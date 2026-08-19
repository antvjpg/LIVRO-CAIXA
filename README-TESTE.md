# Livro-Caixa V17-16 — versão independente de testes

Esta pasta contém uma cópia independente baseada em `index(V.17-15CLAUDE)-beta.html`. O arquivo beta original não foi sobrescrito e nenhuma alteração foi aplicada ao app principal.

## Conteúdo

`index.html` contém a interface e a lógica do beta com o refinamento visual V17-16. `manifest.webmanifest`, `sw.js` e os três PNGs mantêm o pacote instalável do PWA; o cache independente está identificado como V16 para evitar servir a versão anterior durante o teste.

## O que foi refinado

A versão aplica Plus Jakarta Sans como base, reforça a hierarquia dos valores financeiros e da ação Novo lançamento, reduz a fragmentação visual das ações auxiliares, melhora a leitura de descrições longas, preserva os metadados de banco e categoria, adiciona microinterações discretas, anima a atualização de valores, inclui skeleton loading nos contêineres financeiros e mantém a barra Liquid Glass com indicador ativo deslizante entre os quatro destinos.

O modal de categorias foi preservado com uma única área de rolagem interna, rodapé separado para Adicionar/Salvar alteração e bloqueio de overflow horizontal. O fluxo Colar texto continua com prévia revisável, detecção de possíveis duplicidades e proteção contra processamento repetido. O fluxo PDF mantém os limites de 12 MB e 80 páginas.

## Validação executada

A sintaxe do JavaScript inline, do service worker e do manifesto foi validada. Foram testadas as prévias móveis clara e escura em 390×844 px, o modal de categorias com lista longa, o estado Investimentos, a navegação para os quatro destinos, a ocultação do Patrimônio fora do Livro-Caixa, a prévia de uma linha colada e a medição de largura do documento sem overflow horizontal.

## Limite conhecido

A validação local foi executada sem uma sessão Firebase autenticada. Por isso, a persistência real no Firestore, a sincronização offline/online, a autenticação e as cotações externas ainda precisam ser confirmadas no dispositivo ou navegador do usuário. O pacote é uma **versão independente de testes**, não uma substituição automática do app principal.

## Uso

Para testar localmente, abra `index.html` em um navegador com conexão à internet. Para testar a instalação PWA, publique os arquivos juntos em um ambiente HTTPS, mantendo os caminhos relativos entre HTML, manifesto, service worker e ícones. Após trocar a versão, faça uma recarga completa ou remova uma instalação anterior para limpar o cache do navegador.
