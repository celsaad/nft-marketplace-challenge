# Kurio — Marketplace de NFTs

Desafio frontend: marketplace de NFTs em React + TypeScript, com backend **simulado** (MSW + Socket.IO) que se comporta como um backend real: REST, sessão, carrinho, cotação, pedidos idempotentes e eventos em tempo real.

- **Aplicação publicada:** https://nft-marketplace-challenge-one.vercel.app
- **Repositório:** https://github.com/celsaad/nft-marketplace-challenge
- **Arquitetura e decisões:** [ARCHITECTURE.md](./ARCHITECTURE.md) · English: [README.en.md](./README.en.md) · [ARCHITECTURE.en.md](./ARCHITECTURE.en.md)

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Zod · Zustand · React Hook Form · Tailwind CSS 4 · shadcn/ui · MSW 2 + `@mswjs/socket.io-binding` + `socket.io-client` · Vitest · Playwright · Lighthouse CI · oxlint + Biome.

## Como rodar

Requisitos: **Node 22+** e **Corepack** (vem com o Node; ele usa a versão do pnpm fixada em `package.json`).

```sh
corepack enable          # uma vez por máquina (ou use "corepack pnpm" no lugar de "pnpm")
pnpm install
pnpm dev                 # http://localhost:5173, com o backend simulado ligado
```

Não há serviço privado nem backend real: um checkout limpo roda inteiro, inclusive os testes.

### Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Desenvolvimento com mocks (MSW + Socket.IO simulado) |
| `pnpm build` | Build otimizado (inclui o backend simulado, como na versão publicada) |
| `pnpm preview` | Serve o build em http://localhost:4173 |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm lint` | oxlint (regras) + Biome (formatação e imports) |
| `pnpm format` | Corrige formatação e o que o lint consegue corrigir |
| `pnpm test` | Testes unitários (Vitest): regras do backend simulado, matemática de ETH, reconciliação de eventos, máquina de estados do checkout |
| `pnpm e2e` | Testes E2E (Playwright) em desktop 1440×900 e mobile 390×844, contra o build otimizado |
| `pnpm e2e:update` | Regenera as baselines de regressão visual |
| `pnpm e2e:report` | Abre o relatório HTML do último E2E (traces das falhas incluídos) |
| `pnpm lighthouse` | Auditoria Lighthouse da versão publicada (mobile e desktop, 3 execuções, mediana em `docs/lighthouse/summary.md`). Precisa do Chrome; sem ele, aponte `CHROME_PATH` para o Chromium do Playwright |
| `pnpm lighthouse:local` | A mesma auditoria contra o `pnpm build` servido pelo `vite preview` em localhost (HTTP/1.1, sem compressão, então o mobile pontua menos) |

Antes do primeiro `pnpm e2e`, instale o navegador: `pnpm exec playwright install chromium`. Para rodar em outra porta: `E2E_PORT=4410 pnpm e2e`.

### Variáveis de ambiente

Os valores padrão estão em `.env` (versionado, sem segredos) e documentados em `.env.example`:

| Variável | Padrão | Função |
|---|---|---|
| `VITE_MOCKS` | `on` | Liga o backend simulado. A demo publicada precisa dele ligado. |
| `VITE_API_URL` | `/api` | Base da API REST (atendida pelo MSW). |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.test` | Endpoint Socket.IO (interceptado pelo MSW). |

## Credenciais fictícias

| Colecionador | E-mail | Senha |
|---|---|---|
| Ana Souza | `ana@jungle.test` | `Password123!` |
| Bruno Lima | `bruno@jungle.test` | `Password123!` |

Ana tem uma carteira principal (Ethereum, MetaMask) e uma secundária (Polygon). Bruno tem uma principal (Ethereum) e uma secundária (Solana). Cupons: `KURIO10` (10%), `LAUNCH05` (0,05 ETH, mínimo de 1 ETH), `EXPIRED20` (expirado). As senhas são guardadas apenas como hash SHA-256 com salt, inclusive no mock.

## Cenários, Mock Lab e reset

O backend simulado tem **cenários** determinísticos. O estado de cada cenário fica salvo no `localStorage` do navegador e sobrevive a recarregar a página.

- **Escolher um cenário:** `?scenario=<nome>` na URL (ex.: `/?scenario=slow-network`), ou pelo **Mock Lab**.
- **Resetar:** `?reset=1` volta o cenário ao estado inicial (o parâmetro é removido da URL, então recarregar depois não reseta de novo).
- **Mock Lab:** botão "Mock Lab" no canto inferior esquerdo da aplicação (inclusive na versão publicada). Permite trocar e resetar cenário, mudar latência, ficar offline, fazer a próxima requisição falhar, mudar preço e disponibilidade de qualquer NFT, derrubar a conexão em tempo real, reenviar eventos duplicados ou antigos, expirar sessões, fazer a carteira recusar conexões e confirmar ou recusar pedidos pendentes. Tudo passa pelo backend simulado e chega à aplicação como respostas REST e eventos Socket.IO reais.

| Cenário | O que muda |
|---|---|
| `default` | Catálogo completo, dois colecionadores, pagamentos confirmam em 2,5 s |
| `empty-catalog` | Nenhum NFT listado (estados vazios) |
| `slow-network` | Respostas levam 2–3,5 s (skeletons, estados pendentes) |
| `variable-latency` | Respostas entre 50 ms e 2,5 s (podem chegar fora de ordem) |
| `flaky` | 30% das requisições falham com 503 (retry e recuperação) |
| `offline` | Toda requisição falha como erro de rede |
| `short-session` | A sessão expira 60 s após o login |
| `payment-rejected` | Todo pagamento é recusado após 2,5 s |
| `slow-confirm` | Pedidos ficam pendentes até serem confirmados/recusados no Mock Lab |
| `order-timeout` | O pedido é criado, mas a resposta se perde; repetir recupera o mesmo pedido |
| `wallet-rejected` | A carteira simulada recusa toda conexão |

## Reproduzindo os fluxos de falha

Entre como Ana em todos os fluxos abaixo. Para estado limpo, abra a URL com `&reset=1`.

1. **Mudança de preço durante o checkout (tempo real):** coloque um NFT no carrinho e vá para o pagamento. No Mock Lab › Catalog, mude o preço desse NFT. A tela anuncia a mudança, o resumo se atualiza e a confirmação exige uma nova revisão, com a cotação nova.
2. **Pagamento recusado:** `/?scenario=payment-rejected&reset=1`, compre algo. O pedido termina recusado, os itens continuam no carrinho e "Tentar novamente" inicia uma nova tentativa.
3. **Timeout com recuperação do mesmo pedido:** `/?scenario=order-timeout&reset=1`, confirme a compra. A resposta se perde; a tentativa entra em recuperação e, ao repetir, recebe o **mesmo** pedido (a chave de idempotência é a mesma). Também dá para fazer só uma vez pelo Mock Lab › "Next order: lose response".
4. **Clique repetido:** clique várias vezes em confirmar. O botão trava no primeiro clique e só um pedido é criado.
5. **Queda de conexão com pedido pendente:** `/?scenario=slow-confirm&reset=1`, confirme uma compra (fica pendente). No Mock Lab, "Drop connection" e recarregue a página. A tela recupera o mesmo pedido pendente; depois confirme no Mock Lab › Pending Orders.
6. **Eventos duplicados/antigos:** no Mock Lab › Realtime, "Re-send last event" e "Send stale event". Nada regride na tela.
7. **Sessão expirada no meio do fluxo:** em `/perfil` ou no pagamento, Mock Lab › "Expire Sessions" e faça qualquer ação. Você vai para o login com o caminho de volta guardado; ao entrar de novo, volta para onde estava (o rascunho do pagamento é restaurado para o mesmo colecionador).
8. **Rede instável, lenta ou offline:** cenários `flaky`, `slow-network`, `variable-latency`, `offline`, ou os controles de rede do Mock Lab.
9. **Conflitos de cadastro e validação:** cadastre-se com `ana@jungle.test` ou com o usuário `ana_souza`. O erro aparece no campo certo.
10. **Cupom inválido/expirado:** no carrinho, aplique `NOPE` ou `EXPIRED20`.

## Testes

- **Unitários (Vitest):** as regras do backend simulado (isolamento entre colecionadores, merge do carrinho de visitante, cupons, cotação obsoleta, idempotência, ciclo de vida do pedido, persistência e cenários), matemática de ETH com `bigint`, o reconciliador de eventos em tempo real e a máquina de estados da tentativa de checkout.
- **E2E (Playwright):** os 12 cenários do desafio, em desktop e mobile, contra o build otimizado, com relatório HTML e traces das falhas. A regressão visual (home, detalhe, carrinho e pagamento) tem baselines versionadas, geradas em macOS/Chromium (sufixo `-darwin`); no CI (Linux) rodam só os testes funcionais.
- **Relógio controlado:** os cenários sensíveis a tempo (sessão de 60 s do cenário `short-session`, atraso do pagamento simulado, timeout de 10 s das requisições) usam o `page.clock` do Playwright e pulam a espera em vez de aguardá-la (`e2e/clock.spec.ts`). Latência e eventos são controlados pelo Mock API.
- **Números atuais:** 110 testes unitários; 70 testes E2E por projeto (desktop e mobile), 139 execuções no total, incluindo as 8 capturas visuais.
- **Lighthouse:** veja [docs/lighthouse/summary.md](./docs/lighthouse/summary.md) e a análise em [ARCHITECTURE.md](./ARCHITECTURE.md#performance).

## Créditos das imagens

As 4 ilustrações vêm do arquivo Figma do desafio. As demais artes de NFT são de domínio público (CC0), do projeto Nouns, sob nomes fictícios; nenhuma arte de coleções comerciais foi usada (ADR 0007). A fonte e a licença de cada arte estão no cabeçalho de `scripts/build-images.mjs`.
