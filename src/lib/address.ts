// One way to shorten addresses and hashes on every screen (wallets, checkout, receipt, NFT contract).

/** "0x1234…abcd": enough to recognise an address without its full 42 characters. */
export function shortAddress(address: string, edge = 6): string {
  return address.length <= edge * 2 + 1 ? address : `${address.slice(0, edge)}…${address.slice(-4)}`
}
