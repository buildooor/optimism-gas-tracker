import { CoinGecko } from '../src/PriceFeed'

describe('PriceFeed', () => {
  it('getPriceByTokenSymbol', async () => {
    const priceFeed = new CoinGecko()
    const price = await priceFeed.getPriceByTokenSymbol('ETH')
    expect(price).toBeGreaterThan(0)
    expect(price).toBeLessThan(10000)
  }, 60 * 1000)
})
