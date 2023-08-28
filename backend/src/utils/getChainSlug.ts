export function getChainSlug (chainId: number) {
  const chainSlug: any = {
    5: 'goerli',
    84531: 'basezk',
    420: 'optimism'
  }

  return chainSlug[chainId]
}
