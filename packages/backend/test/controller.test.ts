import { Controller } from '../src/controllers/MainController'

describe('Controller', () => {
  it('getUsdPrice', async () => {
    const controller = new Controller()
    const price = await controller.getCurrentEthUsdPrice()
    console.log(price)
    expect(price).toBeTruthy()
  }, 60 * 1000)
  it('getEthEstimate', async () => {
    const controller = new Controller()
    const { eth, usd } = await controller.getGasEstimate(500_000)
    console.log(eth, usd)
    expect(eth).toBeTruthy()
  }, 60 * 1000)
  it('gas price poller', async () => {
    const controller = new Controller()
    await controller.startGasPricePoller()
  }, 60 * 1000)
  it.only('getClosestEthPriceUsd', async () => {
    const controller = new Controller()
    const price = await controller.getClosestEthPriceUsd(1692766818)
    console.log(price)
    expect(price).toBeTruthy()
    // let price = await controller.getClosestEthPriceUsd(1693544241)
    // console.log(price)
    // expect(price).toBeTruthy()
  }, 60 * 1000)
})
