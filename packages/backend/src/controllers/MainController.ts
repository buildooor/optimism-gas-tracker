import level from 'level'
import subleveldown from 'subleveldown'
import txEstimates from '../config/txEstimates.json'
import addressAliases from '../config/addressAliases.json'
import wait from 'wait'
import { DateTime } from 'luxon'
import { DbController } from './DbController'
import { PriceFeed } from './PriceFeedController'
import { currencyFormatter } from '../utils/currencyFormatter'
import { dbPath } from '../config'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { getRpcProvider } from '../utils/getRpcProvider'
import { getTimeRangeToSeconds } from '../utils/getTimeRangeToSeconds'
import { numberFormatter } from '../utils/numberFormatter'
import { promiseQueue } from '../utils/promiseQueue'
import { providers } from 'ethers'
import { removeOutliersByZScore } from '../utils/removeOutliersByZScore'
import { rpcUrls } from '../config/rpcUrls'
import { withTimeout } from '../utils/withTimeout'

const db = level(dbPath)
const syncStateDb = subleveldown(db, 'syncState')

export class Controller {
  provider: any
  gasPriceProvider: any
  promiseCache: any = {}
  db: any
  priceFeed: PriceFeed

  constructor () {
    this.db = new DbController()
    this.priceFeed = new PriceFeed()
    this.provider = getRpcProvider('optimism')
    this.gasPriceProvider = getRpcProvider(process.env.GAS_PRICE_OPTIMISM_RPC || process.env.OPTIMISM_RPC || rpcUrls[0])
  }

  async startGasPricePoller () {
    while (true) {
      try {
        await this.pollGasPrice()
      } catch (err: any) {
        console.error(err)
      }
      await wait(1000 * 2)
    }
  }

  async startTopGasGuzzlersPoller () {
    while (true) {
      try {
        const key = 'spenders'
        let lastSyncedBlocked: any = null
        try {
          lastSyncedBlocked = await syncStateDb.get(key)
        } catch (err: any) {
        }
        const endBlockNumber = (await this.provider.getBlockNumber() - 1)
        const startBlockNumber = lastSyncedBlocked ? Number(lastSyncedBlocked) : endBlockNumber - 1
        if (startBlockNumber === endBlockNumber || startBlockNumber > endBlockNumber) {
          await wait(100)
          continue
        }
        await this.syncTopGasSpenders(startBlockNumber, endBlockNumber)
        await syncStateDb.put(key, endBlockNumber.toString())
      } catch (err: any) {
        console.error(err)
      }
      await wait(100)
    }
  }

  async pollGasPrice () {
    const block = await this.gasPriceProvider.getBlock('latest')
    const ethPrice = await this.getCurrentEthUsdPrice()
    const gasPrice = await this.getOnchainGasPrice()

    await this.db.upsertGasPrice({
      gasPrice: gasPrice.gwei,
      ethPriceUsd: ethPrice,
      blockNumber: block.number,
      timestamp: block.timestamp
    })
  }

  async getCurrentEthUsdPrice () {
    return this.priceFeed.getPriceByTokenSymbol('ETH')
  }

  async getClosestEthPriceUsd (timestamp: number): Promise<number> {
    const price = await this.db.getClosestEthPriceUsd(timestamp)

    if (!price) {
      throw new Error('No entries found in the database, which should not happen.')
    }

    return price
  }

  async getOnchainGasPrice () {
    const gasPrice = await this.gasPriceProvider.getGasPrice()
    return {
      wei: gasPrice.toString(),
      gwei: formatUnits(gasPrice, 9),
      eth: formatUnits(gasPrice, 18)
    }
  }

  async getHistoricalGasPrices (startTimestamp: number, endTimestamp: number): Promise<any[]> {
    const historical = await this.db.getGasPrices({
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      offset: 0
    })

    return historical
  }

  async getGasEstimate (gasLimit: number) {
    const usdPrice = await this.getCurrentEthUsdPrice()

    const { baseFeePerGas: l2BaseFee } = await this.gasPriceProvider.getBlock('latest')
    const { maxPriorityFeePerGas: l2PriorityFee } = await this.gasPriceProvider.getFeeData()
    const txGasPrice = l2BaseFee.add(l2PriorityFee)
    const l2ExecutionFee = txGasPrice.mul(gasLimit)
    const l2ExecutionFeeEth = Number(formatUnits(l2ExecutionFee, 18))
    const usdEstimate = l2ExecutionFeeEth * usdPrice

    return {
      eth: l2ExecutionFeeEth,
      usd: usdEstimate,
      usdDisplay: currencyFormatter.format(usdEstimate)
    }
  }

  async syncTopGasSpenders (startBlockNumber: number, endBlockNumber: number) {
    const blockNumbers: any[] = []
    for (let blockNumber = startBlockNumber; blockNumber <= endBlockNumber; blockNumber++) {
      blockNumbers.push(blockNumber)
    }

    let index = 0
    let provider = new providers.StaticJsonRpcProvider(rpcUrls[index])
    await promiseQueue(blockNumbers, async (blockNumber: number, i: number) => {
      let success = false
      while (!success) {
        index = (index + 1) % rpcUrls.length // Wrap around to the beginning
        const rpcUrl = rpcUrls[index]
        try {
          provider = new providers.StaticJsonRpcProvider(rpcUrl)
          console.log(`processing #${i}/${blockNumbers?.length}: ${blockNumber}/${endBlockNumber}`)
          console.log(blockNumber, startBlockNumber, endBlockNumber)
          const block = await withTimeout(provider.getBlockWithTransactions(blockNumber), 10 * 1000)
          console.log('txs', block.transactions.length)

          let j = 0
          await promiseQueue(block.transactions, async (tx: any, i: number) => {
            try {
              index = (index + 1) % rpcUrls.length // Wrap around to the beginning
              const rpcUrl = rpcUrls[index]
              provider = new providers.StaticJsonRpcProvider(rpcUrl)
              console.log(`processing tx #${j}/${block.transactions.length}`)
              j++
              const receipt = await withTimeout(provider.getTransactionReceipt(tx.hash), 10 * 1000)
              const gasUsed = receipt.gasUsed

              if (!tx.gasPrice) {
                throw new Error('expected tx.gasPrice')
              }

              const ethPriceUsd = await this.getClosestEthPriceUsd(block.timestamp)

              const value = {
                timestamp: block.timestamp,
                txHash: tx.hash,
                gasUsed: gasUsed.toString(),
                gasPrice: tx.gasPrice.toString(),
                ethPriceUsd
              }

              await this.db.upsertSpender({
                address: tx.from.toLowerCase(),
                ...value
              })

              if (tx.to) {
                await this.db.upsertGuzzler({
                  address: tx.to.toLowerCase(),
                  ...value
                })
              }
            } catch (err: any) {
              console.error(err)
            }
          }, { concurrency: 10 })
          console.log(`done processing #${i}/${blockNumbers?.length}: ${blockNumber}/${endBlockNumber}`)
          success = true
        } catch (err: any) {
          console.log('error, try index', index, rpcUrl, err)
        }
      }
    }, { concurrency: 5 })
  }

  async handleRequest (request: any) {
    const { method, params } = request
    if (!method) {
      throw new Error('Method not specified')
    }
    if (!Array.isArray(params)) {
      throw new Error('Params must be an array')
    }
    const mapping = {
      gasTracker_getCurrentEthUsdPrice: this.handleGetCurrentEthUsdPrice,
      gasTracker_getCurrentGasPrice: this.handleGetCurrentGasPrice,
      gasTracker_getGasEstimates: this.handleGetGasEstimates,
      gasTracker_getHistoricalGasPrices: this.handleGetHistoricalGasPrices.bind(this, params),
      gasTracker_getTopGasSpenders: this.handleGetTopGasSpenders.bind(this, params),
      gasTracker_getTopGasGuzzlers: this.handleGetTopGasGuzzlers.bind(this, params)
    }

    const fn = mapping[method]
    if (!fn) {
      throw new Error(`Method not found: ${method}`)
    }

    return fn.call(this)
  }

  async handleGetCurrentGasPrice () {
    const gasPrice = await this.getOnchainGasPrice()
    return {
      gasPrice,
      timestamp: Math.floor(Date.now() / 1000)
    }
  }

  async handleGetCurrentEthUsdPrice () {
    const price = await this.getCurrentEthUsdPrice()
    const priceDisplay = currencyFormatter.format(price)
    return {
      price,
      priceDisplay,
      timestamp: Math.floor(Date.now() / 1000)
    }
  }

  async handleGetGasEstimates () {
    const estimates: any[] = []
    for (const [key, value] of Object.entries(txEstimates)) {
      const gasEstimate = await this.getGasEstimate(value)
      estimates.push({
        action: key,
        gasLimit: value,
        gasLimitDisplay: numberFormatter.format(value),
        ...gasEstimate
      })
    }

    return {
      estimates
    }
  }

  async handleGetHistoricalGasPrices (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(Date.now() / 1000)
    const endTime = currentTime
    const startTime = endTime - timeRangeSeconds
    const gasPrices = await this.getHistoricalGasPrices(startTime, endTime)
    const _gasPrices = gasPrices.map((item: any) => Number(item.gasPrice))
    const filteredGasPrices = removeOutliersByZScore(_gasPrices)

    const filteredGasData = gasPrices.filter((item: any) => filteredGasPrices.includes(Number(item.gasPrice))).map(x => {
      return {
        block: x.block,
        timestamp: x.timestamp,
        gasPrice: {
          gwei: x.gasPrice,
          wei: formatUnits(parseUnits(x.gasPrice, 'gwei').toString(), 'wei')
        }
      }
    })

    const sortedData: any[] = filteredGasData.sort((a, b) => a.timestamp - b.timestamp)

    if (sortedData.length === 0) {
      return {
        gasPrices: []
      }
    }

    const minTimestamp = sortedData[0].timestamp
    const maxTimestamp = sortedData[sortedData.length - 1].timestamp

    const totalRange = maxTimestamp - minTimestamp
    const resampleInterval = Math.ceil(totalRange / 49) // We use 49 to make sure we include both the start and end points, making it 50 points

    // Generate an array of timestamps based on the resample interval
    const newTimestamps: any[] = []
    for (let t = minTimestamp; t <= maxTimestamp; t += resampleInterval) {
      newTimestamps.push(t)
    }

    // Find the corresponding gasPrice for each new timestamp
    const resampledData = newTimestamps.map((newTimestamp) => {
      // Find the closest original data point to the new timestamp
      const closestPoint = sortedData.reduce((prev, curr) => {
        return Math.abs(curr.timestamp - newTimestamp) < Math.abs(prev.timestamp - newTimestamp) ? curr : prev
      })

      return {
        block: closestPoint.block,
        timestamp: newTimestamp,
        gasPrice: {
          gwei: closestPoint.gasPrice.gwei,
          wei: formatUnits(parseUnits(Number(closestPoint.gasPrice.gwei.toString()).toFixed(9), 'gwei').toString(), 'wei')
        }
      }
    })

    return {
      gasPrices: resampledData
    }
  }

  async handleGetTopGasSpenders (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(DateTime.fromSeconds(Math.floor(Date.now() / 1000)).toUTC().startOf('minute').toSeconds())
    const gasSpenders = await this.rankAddressesForTimeRange('spenders', currentTime - timeRangeSeconds, currentTime)
    return {
      gasSpenders: gasSpenders.slice(0, 25)
    }
  }

  async handleGetTopGasGuzzlers (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(DateTime.fromSeconds(Math.floor(Date.now() / 1000)).toUTC().startOf('minute').toSeconds())
    const gasGuzzlers = await this.rankAddressesForTimeRange('guzzlers', currentTime - timeRangeSeconds, currentTime)
    return {
      gasGuzzlers: gasGuzzlers.slice(0, 25)
    }
  }

  async queryTransactions (kind: string, startTimestamp: number, endTimestamp: number): Promise<any[]> {
    let items: any = []
    if (kind === 'guzzlers') {
      items = await this.db.getGuzzlers({
        startTimestamp,
        endTimestamp,
        offset: 0
      })
    } else {
      items = await this.db.getSpenders({
        startTimestamp,
        endTimestamp,
        offset: 0
      })
    }

    return items.map((item: any) => {
      return {
        timestamp: item.timestamp,
        address: item.address,
        gasUsed: BigInt(item.gasUsed),
        gasPrice: BigInt(item.gasPrice),
        ethPriceUsd: item.ethPriceUsd
      }
    })

    // const key = `queryTransactions-${kind}-${startTime}-${endTime}`
    // const cachedP = await this.promiseCache[key]
    // if (cachedP) {
    //   console.log('cachedP', key)
    //   return cachedP
    // } else {
    //   console.log('no cache', key)
    // }

    // this.promiseCache[key] = p

    // return p
  }

  async rankAddressesForTimeRange (kind: string, startTime: number, endTime: number): Promise<any[]> {
    const transactions = await this.queryTransactions(kind, startTime, endTime)
    const gasUsageByAddress: any = {}

    for (const tx of transactions) {
      const totalGas = BigInt(tx.gasUsed * tx.gasPrice)
      const totalGasUsd = Number(formatUnits(totalGas.toString(), 18)) * tx.ethPriceUsd
      if (gasUsageByAddress[tx.address]) {
        const v = BigInt(gasUsageByAddress[tx.address].totalGas)
        const res = BigInt(totalGas) + v

        const v1 = gasUsageByAddress[tx.address].totalGasUsd
        const res1 = totalGasUsd + Number(v1)
        gasUsageByAddress[tx.address].totalGas = res
        gasUsageByAddress[tx.address].totalGasUsd = res1
      } else {
        gasUsageByAddress[tx.address] = {
          totalGas,
          totalGasUsd
        }
      }
    }

    const sortedAddresses = Object.entries(gasUsageByAddress)
      .map(([address, item]: any) => {
        const { totalGas, totalGasUsd } = item
        const totalGasEth = formatUnits(totalGas.toString(), 18)
        return {
          address,
          alias: addressAliases[address],
          totalGas: totalGasEth,
          totalGasUsd: totalGasUsd,
          totalGasUsdDisplay: currencyFormatter.format(totalGasUsd)
        }
      })
      .sort((a: any, b: any) => (Number(b.totalGasUsd) - Number(a.totalGasUsd)))

    return sortedAddresses
  }
}
