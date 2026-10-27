# CineList

Aplicação desktop para pesquisar filmes e séries no TMDB e manter rankings pessoais independentes.

## Executar

1. Instale o [Node.js](https://nodejs.org/) (versão LTS).
2. Na pasta do projeto, execute `npm install` e depois `npm start`.
3. Em **Configurações**, cole o **API Read Access Token** criado em [TMDB › API](https://www.themoviedb.org/settings/api).

## Como as listas funcionam

Ao adicionar um título, ele é incluído simultaneamente em:

- Lista geral;
- Lista da década de lançamento/estreia;
- Uma lista para cada país de produção/origem informado pelo TMDB;
- Uma lista para cada gênero informado pelo TMDB.

As listas guardam apenas referências ao mesmo título. Portanto, **remover de uma lista remove só aquela participação**; as demais listas e seus rankings permanecem intactos. Adicionar novamente um título o recoloca em todas as listas automáticas, sem duplicá-lo.

O ranking é específico de cada lista: arraste os itens para mudar a ordem. Dados e listas ficam em um arquivo local no diretório de dados do Electron; o token é protegido pelo armazenamento criptografado do sistema quando disponível.

Para registros criados antes do recurso de países, abra **Configurações** e clique em **Atualizar países dos títulos existentes**. A aplicação consulta diretamente o TMDB pelo ID já salvo em cada título e não altera as outras listas ou seus rankings.

Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.
