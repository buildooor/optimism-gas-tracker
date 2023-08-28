import fetch from 'isomorphic-fetch'

const cache: {
  [tokenSymbol: string]: Promise<any>
} = {}

const cacheTimestamps: {
  [tokenSymbol: string]: number
} = {}

interface IResult {
  id: string
  symbol: string
  name: string
  image: string
  priceUsd: number
}

export class CoinGecko {
  apiKey: string
  private _baseUrl: string = 'https://api.coingecko.com/api/v3'
  cacheTimeMs = 5 * 60 * 1000

  constructor (apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey
      this._baseUrl = 'https://pro-api.coingecko.com/api/v3'
    }
  }

  async getPriceByTokenSymbol (tokenSymbol: string, base: string = 'usd') {
    const cacheKey = `${tokenSymbol}`
    if ((cache as any)[cacheKey] && cacheTimestamps[cacheKey]) {
      const isRecent = cacheTimestamps[cacheKey] > Date.now() - this.cacheTimeMs
      if (isRecent) {
        return cache[cacheKey]
      }
    }
    const promise = this._getPriceByTokenSymbol(tokenSymbol, base)
    cache[cacheKey] = promise
    cacheTimestamps[cacheKey] = Date.now()
    return promise
  }

  async _getPriceByTokenSymbol (
    tokenSymbol: string,
    base: string = 'usd'
  ) {
    try {
      const coinId = 'ethereum'
      const params: any = {
        ids: coinId,
        vs_currencies: base,
        include_market_cap: false,
        include_24hr_vol: false,
        include_24hr_change: false,
        include_last_updated_at: false
      }

      let qs = ''
      for (const key in params) {
        qs += `${key}=${params[key]}&`
      }
      const url = `${this._baseUrl}/simple/price?${qs}`
      const res = await fetch(url)
      const json = await res.json()
      const price = this._normalizePrice(json[coinId][base])
      return price
    } catch (err) {
      return null
    }
  }

  private _normalizePrice = (price: string | number) => {
    price = Number(price)

    // If the API call did not return a number, throw an error
    if (Number.isNaN(price)) {
      throw new Error('invalid price')
    }

    return price
  }
}
