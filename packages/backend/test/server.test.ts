import request from 'supertest'
import { app } from '../src/server'

describe('Server', () => {
  it('getCurrentEthUsdPrice', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getCurrentEthUsdPrice', params: [], id: 1 })
    const { result } = res.body
    console.log(result)
    expect(result.price).toBeGreaterThan(0)
    expect(result.price).toBeLessThan(10000)
  }, 60 * 1000)
  it('getGasEstimates', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getGasEstimates', params: [], id: 1 })
    const { result } = res.body
    console.log(result.estimates)
    expect(result.estimates.length).toBeGreaterThan(0)
    expect(result.estimates[0].action).toBe('ETH Send')
    expect(result.estimates[0].usd).toBeGreaterThan(0)
  }, 60 * 1000)
  it('getHistoricalGasPrices', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getHistoricalGasPrices', params: [], id: 1 })
    const { result } = res.body
    console.log(result)
    expect(result.gasPrices.length).toBeGreaterThan(0)
  }, 60 * 1000)
  it('getTopGasGuzzlers', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getTopGasGuzzlers', params: [], id: 1 })
    const { result } = res.body
    console.log(result)
    expect(result.gasGuzzlers.length).toBeGreaterThan(0)
  }, 5 * 60 * 1000)
  it.only('getTopGasSpenders', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getTopGasSpenders', params: ['7d'], id: 1 })
    const { result } = res.body
    console.log(result)
    expect(result.gasSpenders.length).toBeGreaterThan(0)
  }, 5 * 60 * 1000)
  it('getCurrentGasPrice', async () => {
    const res = await request(app).post('/').send({ method: 'gasTracker_getCurrentGasPrice', params: [], id: 1 })
    const { result } = res.body
    console.log(result)
    expect(Number(result.gasPrice.gwei)).toBeGreaterThan(0)
    expect(Number(result.gasPrice.gwei)).toBeLessThan(100)
  }, 5 * 60 * 1000)
})
