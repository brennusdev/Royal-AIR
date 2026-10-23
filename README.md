# Royal AIRDROPING

## Meu Drop

A página `Backend/MeuDrop.html` reúne as áreas de estudo da plataforma e um painel pessoal:

- **Aprender:** sugere próximos passos com base nos assuntos, aulas assistidas e linguagem de um repositório selecionado.
- **Repositórios:** consulta os repositórios públicos de um usuário pela API do GitHub. Compara apenas assuntos e títulos de aulas cadastrados com nome, descrição, tópicos e linguagem dos repositórios, e destaca um projeto para praticar.
- **Vídeos:** pesquisa aulas no YouTube e permite adicionar links de vídeos ao Meu Drop.
- **Meu Drop:** organiza assuntos e aulas, acompanha a reprodução dos vídeos incorporados e contabiliza uma aula como concluída ao assistir pelo menos 80% da duração.
- **Painel pessoal:** mostra tempo total assistido e nos últimos sete dias, aulas concluídas e commits públicos dos últimos 30 dias nos até cinco repositórios mais relacionados aos estudos. A consulta de commits pode ser limitada pelo GitHub sem autenticação; a interface sinaliza falhas e resultados truncados.

Os assuntos, aulas, perfil público consultado, métricas de commits e tempos assistidos são armazenados no `localStorage` do navegador atual. O tempo mede o período em que os vídeos avançam dentro do player do Meu Drop; estudo fora desta página não é contabilizado. A sugestão de projeto é baseada somente nos assuntos e títulos das aulas cadastrados e nos metadados públicos dos repositórios; ela não analisa código nem identifica tarefas pendentes. As sugestões são regras locais, não uma integração com um modelo de IA.

Este projeto ainda usa um formulário de login demonstrativo, sem autenticação real. Portanto, o painel é pessoal apenas neste navegador: não oferece isolamento seguro entre contas, sincronização entre dispositivos ou acesso a repositórios privados. Essas capacidades exigem autenticação e serviços de backend. Vídeos que não permitem reprodução incorporada podem ser abertos no YouTube, mas o tempo assistido fora desta página não é contabilizado.

Sirva a página por HTTP ou HTTPS para que o player incorporado do YouTube funcione corretamente; abrir o arquivo diretamente pelo endereço `file://` pode impedir a reprodução e o registro do progresso.
