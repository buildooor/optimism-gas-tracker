import { Controller } from '../src/controller'

describe('Controller', () => {
  it('getUsdPrice', async () => {
    const controller = new Controller()
    const price = await controller.getEthUsdPrice()
    console.log(price)
    expect(price).toBeTruthy()
  }, 60 * 1000)
  it('getEthEstimate', async () => {
    const controller = new Controller()
    const { eth, usd } = await controller.getGasEstimate(500_000)
    console.log(eth, usd)
    expect(eth).toBeTruthy()
  }, 60 * 1000)
  it.only('gas price poller', async () => {
    const controller = new Controller()
    await controller.startGasPricePoller()
  }, 60 * 1000)
})
