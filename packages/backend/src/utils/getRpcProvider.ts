import { providers } from 'ethers'
import { rpcUrls } from '../config'

export function getRpcProvider (chainOrUrl: string) {
  const url = chainOrUrl.startsWith('http') ? chainOrUrl : rpcUrls[chainOrUrl]
  return new providers.StaticJsonRpcProvider(url)
}
