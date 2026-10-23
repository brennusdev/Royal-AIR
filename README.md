# Royal AIRDROPING

## Meu Drop

A página `Backend/MeuDrop.html` reúne as áreas de estudo da plataforma:

- **Aprender:** sugere próximos passos com base nos assuntos, aulas assistidas e linguagem de um repositório selecionado.
- **Repositórios:** consulta os repositórios públicos de um usuário pela API do GitHub.
- **Vídeos:** pesquisa aulas no YouTube e permite adicionar links de vídeos ao Meu Drop.
- **Meu Drop:** organiza assuntos e aulas, acompanha a reprodução dos vídeos incorporados e contabiliza uma aula como concluída ao assistir pelo menos 80% da duração.

Os assuntos, aulas e tempos assistidos são armazenados no `localStorage` do navegador atual. As sugestões são regras locais, não uma integração com um modelo de IA. Repositórios privados, sincronização entre dispositivos e recomendações de IA generativa exigem autenticação e serviços de backend, que ainda não fazem parte deste projeto. Vídeos que não permitem reprodução incorporada podem ser abertos no YouTube, mas o tempo assistido fora desta página não é contabilizado.

Sirva a página por HTTP ou HTTPS para que o player incorporado do YouTube funcione corretamente; abrir o arquivo diretamente pelo endereço `file://` pode impedir a reprodução e o registro do progresso.
