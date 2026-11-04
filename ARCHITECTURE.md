# Arquitetura

Como a aplicação é organizada, os contratos entre as partes e o porquê das escolhas. English: [ARCHITECTURE.en.md](./ARCHITECTURE.en.md).

Para aprofundar: [GLOSSARY.md](./GLOSSARY.md) (vocabulário do domínio), [docs/decisions.md](./docs/decisions.md) (todas as decisões), [docs/module-design.md](./docs/module-design.md) (módulos e interfaces) e [docs/adr/](./docs/adr/) (as 8 decisões difíceis de reverter).

## 1. Visão geral

```
routes/ (TanStack Router: telas, search params, guarda de rotas privadas)
   └─ features/ (catalog, nft, favorites, cart, checkout, orders, auth, account, wallets)
        └─ app/ (api: Axios + erros tipados · query: chaves e política de cache
                 · session: ciclo de vida da sessão · realtime: socket + reconciliador)
             └─ contracts/ (Zod: REST, eventos, formulários)   lib/ (ETH em bigint, i18n)

mocks/ (o backend simulado, só carregado por src/main.tsx)
   world/ (regras de negócio, cenários, persistência)  http/ (MSW REST)  realtime/ (MSW Socket.IO)
```

- **O código da aplicação nunca importa `src/mocks`.** Uma regra do oxlint (`no-restricted-imports`) garante isso; só `src/main.tsx` sabe que o mock existe e o liga por configuração (`VITE_MOCKS`). Componentes, hooks e o cliente Axios não têm nenhuma resposta falsa nem caminho alternativo (ADR 0001).
- **Contratos únicos.** Os esquemas Zod em `src/contracts/` validam o transporte (cada resposta da API é parseada), os formulários (React Hook Form + `zodResolver`) e o próprio mock. As mensagens de validação são chaves de i18n, então o erro do servidor e o do formulário são o mesmo texto.
- **Estado tem um lugar só** (docs/decisions.md §State management):

| Tipo de estado | Onde vive |
|---|---|
| Dados do servidor (catálogo, NFT, carrinho, cotação, favoritos, pedidos, perfil, carteiras) | TanStack Query, e só lá |
| Busca, filtros, ordenação, página, `redirect` | Search params do TanStack Router, validados com Zod |
| Token da sessão, colecionador atual, id do carrinho de visitante, idioma | Zustand (persistido), lido fora do React pelo Axios e pelo socket |
| Tentativa de checkout e rascunho do pagamento | `sessionStorage` |
| Formulários | React Hook Form |

## 2. Contrato REST

Base `VITE_API_URL` (padrão `/api`). Cabeçalhos: `Authorization: Bearer <token>` (sessão), `X-Cart-Id` (carrinho de visitante, só sem sessão), `Idempotency-Key` (criação de pedido). A tabela completa, com o esquema de entrada de cada rota, está em `src/mocks/http/routes.ts`.

| Recurso | Operações |
|---|---|
| Sessão e conta | `POST /auth/signup`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs | `GET /nfts` (busca, filtros, ordenação, paginação, contagens por faceta), `GET /nfts/:id`, `GET /nfts/:id/reviews` |
| Favoritos | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart`, `POST /cart/lines`, `PATCH /cart/lines/:id`, `DELETE /cart/lines/:id`, `PUT /cart/coupon`, `DELETE /cart/coupon` |
| Cotação | `POST /quotes` (rede de pagamento → subtotal, desconto, taxa de rede, total, `issues`, `hash`) |
| Pedidos | `POST /orders` (com `Idempotency-Key`), `GET /orders/:id` |
| Perfil | `GET /me`, `PATCH /me`, `PUT /me/avatar`, `POST /me/password` |
| Carteiras | `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/connect`, `POST /wallets/:id/disconnect` |

**Erros:** `{ error: { code, message, fieldErrors? } }`, com um status HTTP por código (`src/contracts/common.ts`): validação (422), sessão inválida/expirada e credenciais (401), sem permissão (403), inexistente (404), conflitos (409: e-mail/usuário em uso, disponibilidade, limite por pedido, cupom inválido/expirado, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`, carteira recusada/rede errada/não conectada) e falha transitória (503). No cliente, tudo vira um `ApiError` com um `kind` discriminado.

**Valores em ETH** trafegam como strings decimais e são calculados em `bigint` (wei, 18 casas). Quantidades são inteiras. A cotação da API é a referência do total (ADR 0006).

## 3. Contrato de eventos (Socket.IO)

Todo evento tem `{ eventId, type, resourceId, version, occurredAt, userId }` (ADR 0002):

| Evento | Público | Payload |
|---|---|---|
| `nft.updated` | todos (`userId: null`) | preço, preço anterior, disponibilidade por edição, esgotado |
| `order.updated` | só o comprador | status (`pending` → `confirmed` ou `rejected`) |

- `version` cresce por recurso. O cliente ignora tudo que não for mais novo do que o último aplicado, então **duplicados e eventos antigos não fazem nada**.
- Um evento privado só se aplica ao colecionador a quem foi endereçado; o servidor também só o entrega para os sockets desse colecionador.
- O socket pertence à sessão: login, logout, expiração e troca de usuário desconectam e reconectam com a nova identidade (o token vai na query da conexão).
- O reconciliador é uma função pura (`src/app/realtime/reconcile.ts`, testada) que devolve efeitos como dados: atualizar o cache do NFT, invalidar carrinho/cotação/pedido, anunciar uma mudança.

## 4. Sessão

- Token opaco com validade controlada pelo servidor, guardado no `localStorage` e enviado pelo interceptor do Axios (ADR 0004). Sobrevive a recarregar a página e é revalidado no boot.
- Qualquer 401 de uma requisição autenticada chama `expire()`: limpa todo dado privado do cache, reconecta o socket como visitante e anuncia "sessão expirou". Uma rota privada aberta leva ao login com `redirect` e `reason=expired`; ao entrar de novo, a pessoa volta para onde estava.
- O rascunho do pagamento é guardado com o id do colecionador e só é restaurado para ele.
- **Isolamento entre usuários:** dados privados ficam no cache sob `['private', collectorId, …]`. Qualquer troca de sessão remove esse ramo inteiro e religa o socket, então nada de um colecionador aparece para outro.

## 5. Carrinho

- O carrinho vive no servidor, inclusive para visitantes (que recebem um `X-Cart-Id` guardado no navegador). No login ou cadastro, o servidor junta o carrinho do visitante ao do colecionador, respeitando a disponibilidade, e o do visitante deixa de existir.
- Cada linha guarda o preço que a pessoa viu por último. A próxima cotação reporta o que mudou (preço, quantidade reduzida, esgotado, cupom removido) **uma vez** e ajusta o carrinho.
- O passo de quantidade atualiza a tela na hora e junta os cliques em uma mutação 400 ms depois, com o valor final (o último vence).

## 6. Cache, retry e sincronização

| Política | Valor e motivo |
|---|---|
| `staleTime` padrão | 30 s: o catálogo também é atualizado por eventos; o carrinho usa 10 s |
| Tempo limite das requisições | 10 s, num timer JS que aborta a requisição (e não no timeout do XHR), para que o relógio controlado dos testes o alcance; o cancelamento do TanStack Query continua valendo |
| Retry de consultas | Só para falhas em que nada foi decidido no servidor (503, rede, timeout), até 2 vezes com backoff; nunca em 4xx |
| Retry de mutações | Nunca automático. A criação de pedido se recupera pela tentativa de checkout, com a mesma chave; o resto pelo "Tentar novamente" da tela |
| Respostas fora de ordem | A chave da consulta é exatamente a busca enviada, e cada requisição é cancelada pelo `signal` quando a busca muda; a página anterior fica visível com "Atualizando…" |
| Depois de uma mutação | O cache é atualizado com a resposta do servidor (carrinho, perfil) ou invalidado (carteiras, cotação) |
| Atualização otimista | Favoritos: a tela muda na hora, um pedido por NFT por vez, a última intenção vence e uma falha volta ao último estado confirmado |
| Eventos | Atualizam o NFT no cache (só se a versão for mais nova), invalidam carrinho e cotação se o NFT estiver no carrinho, e o pedido em `order.updated` |

**Falhas, em três camadas.**
- **Requisição que falha:** cada consulta mostra seu próprio estado de erro com "Tentar novamente" no conteúdo principal; painéis secundários (NFT em destaque, "Mais desta coleção", recomendações do carrinho) somem, sem travar a página. A decisão sobre o que mostrar (nada se a sessão acabou, erros nos campos, ou uma mensagem) fica em um só módulo, `src/ui/failure.ts`.
- **Seção que quebra ao desenhar (bug):** `SectionBoundary` isola a seção; as secundárias somem e as demais mostram um aviso com nova tentativa. Cabeçalho, rodapé e barra de abas também ficam isolados.
- **Rota que quebra:** a tela de erro padrão do roteador (`src/app/route-error.tsx`) aparece dentro do shell, no visual e no idioma do app, com nova tentativa e "Voltar ao início".

## 7. Reconciliação entre REST e Socket.IO

O REST é a fonte da verdade; os eventos são avisos versionados (ADR 0002). Um evento perdido só custa uma nova busca: ao reconectar, o cliente invalida todas as consultas ativas e as busca de novo pelo REST, em vez de tentar reproduzir os eventos perdidos. Mudanças feitas no mock (pelo REST, pelo Mock Lab ou pelos testes) passam todas pela mesma base, que só emite o evento depois de gravar a mudança, então REST e eventos nunca discordam (ADR 0001).

## 8. Checkout: integridade e idempotência

- A cotação tem `id`, `hash` (linhas, preços, cupom e taxa) e validade. Criar o pedido exige `quoteId` + `quoteHash` + `Idempotency-Key`. Se algo mudou desde a cotação, o servidor responde `409 QUOTE_STALE` e a tela mostra o que mudou e pede uma nova confirmação (ADR 0003).
- A tentativa de checkout é uma máquina de estados pura (`reviewing`, `quoteChanged`, `submitting`, `pending`, `recovering`, `confirmed`, `rejected`, `failed`), testada antes da implementação. Uma chave por tentativa, guardada no `sessionStorage`: clique repetido, timeout, recarga e reconexão reusam a mesma chave e recebem o mesmo pedido. A mesma chave com conteúdo diferente dá `409 IDEMPOTENCY_CONFLICT`.
- A disponibilidade fica reservada enquanto o pagamento está pendente e é liberada se ele for recusado. A confirmação só aparece para pedidos confirmados pela simulação. Ao confirmar, só as quantidades compradas saem do carrinho, e o recibo é uma cópia congelada: mudanças posteriores no catálogo não o alteram.
- Cada carteira carrega os dados do comprador, e o pagamento é preenchido a partir da carteira escolhida. Os esquemas de carteira e de pagamento usam os mesmos validadores, então uma carteira nunca guarda dados que o pagamento recusaria.

## 9. Segurança nas interações

| Interação | Tratamento |
|---|---|
| Busca | Debounce de 300 ms, URL com `replace`, requisição anterior cancelada |
| Faixa de preço | Só vale ao clicar em "Aplicar" |
| Quantidade no carrinho | Tela imediata, uma mutação após 400 ms com o valor final |
| Favorito | Fila por NFT, última intenção vence, rollback na falha |
| Formulários (cupom, perfil, carteira, login) | Botão desabilitado com indicador enquanto envia; sem debounce |
| "Confirmar compra" | Trava no primeiro clique + chave de idempotência |

## 10. Backend simulado

- **World** (`src/mocks/world/`): todas as regras (sessões, catálogo, favoritos, carrinhos, cupons, cotações, pedidos, perfil, carteiras) atrás de uma interface pequena, `exec(op, input, ctx)`, com relógio, armazenamento e geração de ids injetados. É testado direto com Vitest, sem navegador.
- **Persistência:** o estado é salvo no `localStorage` após cada mudança, separado por cenário. Pagamentos pendentes continuam depois de recarregar, sem criar outro pedido. `reset` volta ao estado inicial do cenário.
- **Rede simulada** (`src/mocks/http/`): latência, taxa de falha, offline e resposta perdida por cenário, com aleatoriedade com semente (reproduzível), e falhas pontuais pelo Mock Lab ou pelos testes.
- **Mock API** (`window.__mock`): a mesma interface usada pelo Mock Lab e pelo Playwright. Ela altera o backend simulado, nunca o estado da aplicação.

### Transporte em tempo real e suas limitações

Os eventos usam `socket.io-client` de verdade, interceptado pela integração de WebSocket do MSW com `@mswjs/socket.io-binding`. Um protótipo (registrado no ADR 0001) mostrou quatro condições, todas atendidas no código:

1. `socket.io-client` só é importado depois que o worker do MSW inicia; antes disso ele captura o `WebSocket` real.
2. Só o transporte `websocket` funciona; o polling HTTP não é suportado pela integração.
3. A integração anuncia um heartbeat mas não envia pings, então o mock envia um ping do Engine.IO a cada 20 s; sem isso o cliente cairia a cada 30 s.
4. A integração confirma a conexão antes de ler o `auth`, então o token vai na query da URL, e uma sessão inválida é recusada fechando a conexão.

Outras limitações: só o namespace padrão, sem callbacks de confirmação (ack), e o "servidor" roda no próprio navegador. O estado simulado é por navegador: duas abas compartilham os dados salvos, mas não os eventos uma da outra.

## 11. Acessibilidade

Navegação por teclado com foco visível e link "Pular para o conteúdo"; foco preso e devolvido ao gatilho em diálogos e gavetas (shadcn/Radix); rótulos e erros ligados aos campos por `aria-describedby` (`FormField`); mudanças em tempo real e resultados de ações anunciados numa região `aria-live` e em toasts; skeletons com `role="status"` e brilho que respeita `prefers-reduced-motion`; textos alternativos nas imagens dos NFTs; estados que não dependem só de cor; sem rolagem horizontal em 390, 768 e 1440 px, nem em 320 px, a largura de um zoom de 400% em 1280 px, sem perda de conteúdo (verificado em `e2e/layout.spec.ts`).

Na pasta `src/ui/primitives/` (componentes gerados pelo CLI do shadcn) algumas regras de lint estão desligadas, porque o CLI segue os padrões ARIA da W3C para carrossel e breadcrumb, que essas regras marcariam. O código da aplicação mantém todas as regras.

## 12. Performance

Auditoria com Lighthouse CI (`pnpm lighthouse`, configs em `lighthouse/`) contra a versão publicada, que serve o mesmo build otimizado do `pnpm build` (hashes dos assets conferidos) por HTTPS, HTTP/2 e Brotli, como os usuários recebem. Cenário padrão, 3 execuções por página e perfil, mediana. Relatórios e ambiente em [docs/lighthouse/summary.md](./docs/lighthouse/summary.md). `pnpm lighthouse:local` audita o `vite preview` em localhost.

| Perfil | Página | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| mobile | Home | 93 | 100 | 100 | 100 | 3,04 s | 0,000 | 8 ms |
| mobile | Detalhe do NFT | 95 | 100 | 100 | 100 | 2,86 s | 0,000 | 0 ms |
| desktop | Home | 100 | 100 | 100 | 100 | 0,62 s | 0,000 | 0 ms |
| desktop | Detalhe do NFT | 100 | 100 | 100 | 100 | 0,58 s | 0,004 | 0 ms |

**Todas as metas são atingidas nos dois perfis. A home no mobile tem a menor folga, 3 pontos.**

A auditoria anterior servia o build com `vite preview` (HTTP/1.1, sem compressão) e dava 72 e 76 no mobile. O app não mudou entre as duas auditorias; o servidor, sim. O throttling simulado do Lighthouse refaz as requisições da página numa rede modelada. Em HTTP/1.1, ele distribui os ~27 arquivos de JS iniciais em 6 conexões que buscam um arquivo de cada vez, e os bytes sem compressão passam todos pelo link simulado de 1,6 Mbps. Em HTTP/2 com Brotli, os mesmos arquivos dividem uma conexão e vão comprimidos. Detalhes e medições: [docs/lighthouse/improvement-research.md](./docs/lighthouse/improvement-research.md).

Por que a home no mobile tem a menor folga (perfil padrão do Lighthouse: 4G lento simulado, CPU 4× mais lenta):
- O elemento de LCP é a imagem do primeiro card do catálogo. Ela só existe depois que a API do catálogo responde, e aqui a API é o backend simulado, que roda no navegador: o chunk dele (60 KB gzip) precisa baixar, executar e registrar o service worker antes da primeira requisição, e o cenário padrão ainda soma 150–400 ms de latência simulada. Em produção, com uma API real, esse chunk e o service worker não existiriam.
- O primeiro paint (2,0 s na home, 1,2 s no detalhe) só precisa do HTML e do CSS do cabeçalho estático, mas o app ainda carrega cerca de 200 KB gzip de JS na inicialização (React DOM, Zod 4, Axios, TanStack Router/Query, Radix), que disputam com as imagens do catálogo o link simulado de 1,6 Mbps.
- O backend simulado fica no build auditado de propósito: o enunciado proíbe simplificações só para a auditoria (ADR 0005).

O que foi feito, medido antes e depois:
- **Chunk do backend simulado de 173 KB para 60 KB gzip:** o MSW usa `tldts` (a lista de sufixos públicos) só para validar domínio de cookies; o app não usa cookies (token em header), então ela é trocada por um stub de 10 linhas (`src/mocks/tldts-stub.ts`).
- **O app renderiza antes do backend simulado estar pronto:** o cliente HTTP e o cliente de tempo real esperam `backendReady`, então a ordem do ADR 0001 continua valendo (nenhuma requisição e nenhum socket.io-client antes do worker), mas o shell, as rotas e os skeletons aparecem enquanto o mock sobe.
- **Um chunk `vendor`** com as bibliotecas que toda página precisa antes do primeiro paint (React, TanStack Router e Query, Axios, zod, zustand, tailwind-merge, clsx, cva): 28 arquivos iniciais viraram 20. Localmente, em HTTP/2 + Brotli, a home no mobile foi de 88–93 para 92–95; na versão publicada, a diferença fica dentro da variação entre execuções (89 → 88, detalhe 90 → 92).
- **Menus do cabeçalho, dicionário EN e um provider sem uso fora do bundle inicial:** os botões de idioma e de conta aparecem na hora, e o código do menu Radix carrega ao passar o mouse, focar ou tocar (o clique o abre; pelo teclado, o foco vai para o primeiro item, como no Radix). Só o PT-BR vai na inicialização, e o EN carrega antes de ser aplicado. O `TooltipProvider` era montado, mas não havia nenhum tooltip. JS inicial de 252,6 para 197,7 KB gzip, de 20 para 9 arquivos. Na versão publicada: home no mobile de 90 para 93.
- **Cabeçalho estático no `index.html`:** a caixa do cabeçalho e o logo (iguais para todo visitante e idioma) aparecem só com o CSS, e o React os substitui no primeiro render. Na versão publicada: home no mobile de 88 para 90, detalhe de 92 para 95, CLS continua 0.
- **Primeira linha de cards** com carregamento imediato e prioridade alta (imagem de LCP).
- **CLS no detalhe de 0,081 para 0,004:** `<main>` reserva a altura da tela, então o rodapé não salta quando o conteúdo chega.
- **SEO de 92 para 100:** `robots.txt` (o rewrite de SPA servia o `index.html` no lugar dele).
- Já existentes: imagens AVIF/WebP com `srcset` 320/640/960 e proporção fixa, rotas com code splitting, fonte local, Mock Lab carregado só com a página ociosa.

Testado e descartado: adiar as imagens das promoções e do journal até estarem a uma tela de distância (o lazy loading nativo do Chrome começa a ~1250 px, então no celular elas carregam junto com o catálogo): reduziu as imagens da home no carregamento de 201 KB para 25 KB, mas não mudou a nota, e as esconderia da baseline visual de página inteira. Também `modulepreload` do chunk do mock (compete por banda com o JS do app e piorou o LCP) e adiar o mock para depois do primeiro frame (sem efeito).

Próximos passos, se fosse preciso mais folga: carregar o sonner (toasts) sob demanda, o que exige envolver toda chamada de `toast()`. Não adianta usar `zod/mini` só nos esquemas das rotas: toda resposta da API é validada com os contratos em zod completo, então o zod continua no caminho crítico, a menos que todos os contratos, formulários e o mock passem para `zod/mini`.

## 13. Decisões de UX e desvios do Figma

O Figma define a identidade visual; o enunciado define o comportamento. Onde os dois não se encaixam, ou o Figma não desenhou algo:

- **Login e cadastro** são rotas próprias (`/entrar`, `/cadastro`) desenhadas como o painel do Figma, para que `redirect` e `reason` fiquem na URL e sobrevivam a recarregar. No desktop, o painel aparece sobre a home esmaecida, como no Figma; a home por trás é uma cópia decorativa e inerte (hero e destaques).
- **Cadastro** não tem campo de nome de exibição (o Figma não tem); o nome de usuário serve de nome de exibição até ser editado no perfil.
- **Carteiras e perfil** seguem o Figma campo a campo. Uma carteira carrega os dados do comprador que o Figma desenha nela. Foi adicionada só uma dica de formato do endereço por rede.
- **Catálogo:** campo de busca no topo da barra lateral (o Figma do desktop não tem um); barra lateral a partir de 1024 px, abaixo disso gaveta de filtros; ordenação sob as abas no mobile; filtros selecionados mostram um ícone, para não depender só de cor; preços com ponto decimal, como no restante do Figma; 9 itens por página.
- **Detalhe do NFT:** a edição padrão é a primeira disponível; as miniaturas são recortes da mesma arte (cada NFT tem uma imagem); o breadcrumb inclui o nome do NFT; os rótulos Contrato/Direitos autorais, que parecem trocados no Figma, foram pareados com o texto certo.
- **Fora do escopo** (Criadores, Aprenda, blog, newsletter, redes sociais, botão de escanear no mobile, links do rodapé, login social, "esqueceu a senha"): aparecem como desenhados, mas levam a uma página "Indisponível nesta demonstração" ou mostram um aviso; nenhum finge ter funcionado.
- **Mobile:** os frames mobile do Figma não têm barra superior; o app mantém uma barra compacta com o logo, o seletor de idioma, o carrinho e a conta, porque os frames não oferecem outro lugar para trocar de idioma, entrar ou sair. Como no Figma, o detalhe, o carrinho e o pagamento trocam a barra de abas por um painel de ação fixo no rodapé (compra, resumo do carrinho, confirmação com o total), em `src/ui/mobile-action-bar.tsx`; a barra superior e o botão de voltar mantêm a navegação. O painel publica a própria altura em `--bottom-bar`, que afasta o fim da página e o botão do Mock Lab, então nada fica escondido atrás dele. No mobile, o botão do Mock Lab é só um ícone, para cobrir menos o conteúdo.
- **Breadcrumb do pagamento:** "Início / Carrinho / Pagamento" (o Figma mostra "Mercado" no meio), porque é o caminho real de volta.
- **Ícones de redes sociais** são monogramas em texto (f, ig, x, in, yt), sem logotipos de marcas.
- **Carrinho:** cada linha mostra também a edição (o enunciado pede respeitar a disponibilidade por edição); os títulos de carrinho e pagamento ficam só para leitores de tela no desktop, onde o Figma mostra apenas o breadcrumb.
- **Pagamento:** o endereço da carteira vem da carteira escolhida e não é editável, para que o pedido sempre seja pago pela carteira selecionada; o campo de carteira secundária aparece ao marcar "Usar outra carteira?"; "Confirmar compra" abre uma revisão antes de enviar, como o enunciado pede. No mobile, o frame mostra só as carteiras e o total, então o formulário (obrigatório) fica empilhado entre as carteiras e o resumo.
- **Confirmação:** é um cartão dentro da página, não uma sobreposição; o link do explorador diz "Ver no explorador" com a marca "Simulado", porque aponta para um explorador fictício.

## 14. Limitações conhecidas

- O backend é simulado no navegador: dados e eventos são locais a cada navegador.
- Os testes de regressão visual têm baselines só para macOS/Chromium; no CI (Linux) rodam só os testes funcionais.
- Referências de transação e links do explorador são simulados e apontam para um domínio fictício.
- As baselines visuais de página inteira no mobile mostram a barra de abas fixa no meio da captura: é como o Playwright costura elementos fixos, não um defeito de layout.
- Login social, "esqueceu a senha" e as seções fora do escopo são apenas visuais (seção 13).
- Refatorações identificadas e ainda não feitas: o "último clique vence" da quantidade no carrinho poderia usar o mesmo módulo puro e testado dos favoritos (`favorites/sync.ts`); `useLiveRegion` poderia sair de `features/cart` para `src/ui`; carrinho, pagamento e detalhe poderiam compartilhar um cabeçalho de página (breadcrumb e voltar no mobile).
