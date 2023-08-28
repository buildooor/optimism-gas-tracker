const baseExplorerUrls = {
  5: 'https://goerli.etherscan.io',
  420: 'https://goerli-optimism.etherscan.io',
  84531: 'https://goerli.basescan.org'
}

export function getBaseExplorerUrl (chainId: number) {
  return baseExplorerUrls[chainId]
}
