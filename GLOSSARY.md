# Kurio NFT Marketplace

A simulated NFT marketplace where Collectors discover, favorite and buy NFT Editions with ETH. All money, wallets and payments are fictional; the backend is a mock that behaves like a real one.

Each term lists the PT-BR label the UI uses for it, so code and screens can be matched.

## People and access

**Collector**:
A registered person who can favorite NFTs, keep a Cart, own Wallets and place Orders. UI: _colecionador_.
_Avoid_: user (in domain code), customer, buyer, account

**Guest**:
A visitor without a Session who can still browse and fill a Cart.
_Avoid_: anonymous user, visitor

**Session**:
The period during which a Collector is authenticated; it ends by logout or Session Expiry.
_Avoid_: login, auth

**Session Expiry**:
The moment a Session stops being valid without the Collector logging out.
_Avoid_: timeout, logout

## Catalog

**NFT**:
A single listed artwork with a token ID, one Category, one Collection, one Network and one or more Editions. UI: _NFT_.
_Avoid_: item, product, token, asset

**Category**:
The kind of art an NFT is, such as digital art, photography or music. UI: _Coleções_ (sidebar filter title, as drawn).
_Avoid_: collection, genre, type

**Collection**:
The creator's series an NFT belongs to, such as Kurio Apes. UI: _Coleção_ ("Mais desta coleção").
_Avoid_: category, series, drop

**Edition**:
A numbered run of an NFT with its own size and Availability; every Edition of an NFT shares the NFT's Price. UI: _Edição_ (1/1, 1/10, 1/50).
_Avoid_: variant, tier, copy

**Open Edition**:
An Edition with no fixed size, limited only by the per-order quantity limit. UI: _ABERTA_.
_Avoid_: unlimited edition

**Price**:
The current ETH amount asked for one unit of an NFT, whatever the Edition.
_Avoid_: cost, value

**Previous Price**:
An NFT's last Price before a drop, shown struck through only while the current Price is lower.
_Avoid_: original price, compare-at price, old price

**Availability**:
How many units of an Edition can still be bought.
_Avoid_: stock, supply, inventory

**Network**:
The blockchain an NFT was minted on (Ethereum, Polygon or Solana); it describes provenance and never restricts payment. UI: _Rede_ (catalog filter).
_Avoid_: chain, blockchain

**Favorite**:
A Collector's mark on an NFT (never on a single Edition). UI: _Favoritar_.
_Avoid_: like, wishlist, bookmark

## Wallets

**Wallet**:
A Collector's registered address on one Network, held through one Wallet Provider. UI: _Carteira_.
_Avoid_: account, address

**Primary Wallet**:
The single Wallet a Collector marks as their main one; all others are secondary. UI: _carteira principal_.
_Avoid_: default wallet, main account

**Wallet Provider**:
The app that holds a Wallet: MetaMask, WalletConnect or Coinbase Wallet. UI: _Tipo de carteira_.
_Avoid_: wallet type, wallet app

**Wallet Connection**:
The simulated approval a Wallet gives at checkout, which ends approved, rejected or disconnected.
_Avoid_: wallet login, signing

## Purchasing

**Cart**:
The set of Cart Lines a Guest or Collector intends to buy. UI: _Carrinho_.
_Avoid_: basket, bag

**Cart Line**:
One NFT Edition in a Cart, with a whole-number quantity.
_Avoid_: cart item, line item, row

**Coupon**:
A code that, while valid, grants a percentage or fixed ETH discount on a Cart's subtotal; a Cart holds at most one. UI: _código promocional_.
_Avoid_: promo code, voucher, discount code

**Payment Network**:
The Network a Collector pays on at checkout; it must match the chosen Wallet and determines the Network Fee. UI: _Rede_ (checkout).
_Avoid_: chain, checkout network

**Network Fee**:
The ETH charged per Order for the chosen Payment Network, never discounted by a Coupon. UI: _Taxa de rede_.
_Avoid_: gas, gas fee, shipping

**Quote**:
The server's authoritative statement of what a Cart costs right now: subtotal, discount, Network Fee and total. UI: _resumo_.
_Avoid_: summary, totals, estimate

**Stale Quote**:
A Quote that no longer matches current Prices, Availability, Coupon or fees.
_Avoid_: outdated price, expired cart

**Checkout Attempt**:
One intention to buy a specific Quote, identified by a single Idempotency Key; retries of the same attempt never create a second Order.
_Avoid_: payment attempt, submission

**Idempotency Key**:
The identifier that makes every retry of a Checkout Attempt resolve to the same Order.
_Avoid_: request id, nonce

**Order**:
The result of a Checkout Attempt, which moves from pending to exactly one terminal state: confirmed or rejected. Buying again after a rejection is a new Checkout Attempt and a new Order. UI: _pedido_.
_Avoid_: purchase, transaction, payment

**Receipt**:
The frozen snapshot of a confirmed Order's lines, fees and total; later catalog changes never alter it. UI: _comprovante_.
_Avoid_: invoice, confirmation, order summary

## Simulation

**Scenario**:
A named, reproducible state of the mock world (data, latency, failures, outcomes) that can be selected and reset.
_Avoid_: fixture set, mock mode, seed

**Mock Lab**:
The control panel through which a person changes the mock world, never the UI state directly.
_Avoid_: dev tools, debug panel
