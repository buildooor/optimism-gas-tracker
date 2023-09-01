import mcache from 'memory-cache'
import { getRpcProvider } from './utils/getRpcProvider'
import { BigNumber, providers } from 'ethers'
import { parseUnits, formatUnits } from 'ethers/lib/utils'
import { CoinGecko } from './PriceFeed'
import level from 'level'
import subleveldown from 'subleveldown'
import wait from 'wait'
import { dbPath } from './config'
import { promiseQueue } from './utils/promiseQueue'
import { DateTime } from 'luxon'
import { Db } from './Db'
// const d3 = require('fix-esm').require('d3')

const rpcUrls: string[] = [
  // 'https://rpc.ankr.com/optimism',
  // 'https://optimism.blockpi.network/v1/rpc/public',
  'https://opt-mainnet.g.alchemy.com/v2/demo',
  // 'https://optimism-mainnet.public.blastapi.io',
  // 'https://api.zan.top/node/v1/opt/mainnet/public',
  'https://optimism.publicnode.com',
  /// 'https://optimism.meowrpc.com',
  // 'https://mainnet.optimism.io',
  'https://rpc.optimism.gateway.fm',
  // 'https://gateway.tenderly.co/public/optimism',
  // 'https://optimism.gateway.tenderly.co',
  // 'https://1rpc.io/op',
  // 'https://optimism.drpc.org',
  // 'https://optimism.api.onfinality.io/public',
  // 'https://endpoints.omniatech.io/v1/op/mainnet/public'
]

const cache = new mcache.Cache()

const db = level(dbPath)
console.log(dbPath)
const topGasSpenders = subleveldown(db, 'gasSpenders')
const topGasGuzzlers = subleveldown(db, 'gasGuzzlers')
const gasDb = subleveldown(db, 'gasPrice')
const syncStateDb = subleveldown(db, 'syncState')

async function withTimeout(promise: any, ms: number) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timedout')), ms)
  )
  return Promise.race([promise, timeout])
}

function removeOutliersByZScore(data: number[], threshold = 2) {
  const mean = data.reduce((acc, val) => acc + val, 0) / data.length
  const stdDev = Math.sqrt(data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length)

  return data.filter((val) => Math.abs((val - mean) / stdDev) < threshold)
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const numbeFormatter = new Intl.NumberFormat('en-US')

export class Controller {
  provider: any
  gasPriceProvider: any
  promiseCache :any = {}
  db: any

  constructor() {
    this.db = new Db()
    this.provider = getRpcProvider('optimism')
    this.gasPriceProvider = new providers.StaticJsonRpcProvider(process.env.GAS_PRICE_OPTIMISM_RPC || process.env.OPTIMISM_RPC || rpcUrls[0])
  }

  async getEthUsdPrice () {
    const coinGecko = new CoinGecko()
    return coinGecko.getPriceByTokenSymbol('ETH')
  }

  async getGasPrice () {
    const gasPrice = await this.gasPriceProvider.getGasPrice()
    return {
      wei: gasPrice.toString(),
      gwei: formatUnits(gasPrice, 9),
      eth: formatUnits(gasPrice, 18)
    }
  }

  async getGasEstimate (gasLimit: number) {
    const l1Fees = 0.000017204380301695 // TODO: calculate this
    const { eth: gasPrice } = await this.getGasPrice()
    const usdPrice = await this.getEthUsdPrice()

    const l2Fees = Number(gasPrice) * gasLimit
    const totalFees = l1Fees + l2Fees
    const usdEstimate = totalFees * usdPrice

    return {
      eth: totalFees,
      usd: usdEstimate,
      usdDisplay: currencyFormatter.format(usdEstimate)
    }
  }

  async pollGasPrice () {
    const block = await this.gasPriceProvider.getBlock('latest')
    const ethPrice = await this.getEthUsdPrice()
    const gasPrice = await this.getGasPrice()
    const value = {
      gasPrice: gasPrice.gwei,
      ethPrice: ethPrice,
      block: block.number,
      timestamp: block.timestamp
    }

    const key = `${block.timestamp}-${block.number}`
    // await gasDb.put(key, JSON.stringify(value))
    await this.db.upsertGasPrice({
      gasPrice: gasPrice.gwei,
      ethPriceUsd: ethPrice,
      blockNumber: block.number,
      timestamp: block.timestamp
    })
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

  async getHistoricalGasPrices (startTimestamp: number, endTimestamp: number): Promise<any[]> {
    const historical = await this.db.getGasPrices({
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      offset: 0
    })

    return historical
  }

  async syncTopGasSpenders (startBlockNumber: number, endBlockNumber: number) {
    const blockNumbers: any[] = []
    // Loop through each block in the last hour
    for (let blockNumber = startBlockNumber; blockNumber <= endBlockNumber; blockNumber++) {
      blockNumbers.push(blockNumber)
    }

    let index = 0
    let provider = new providers.StaticJsonRpcProvider(rpcUrls[index])
    console.log('block numbers', blockNumbers.length)
    await promiseQueue(blockNumbers, async (blockNumber: number, i: number) => {
      let success = false
      while (!success) {
        index = (index + 1) % rpcUrls.length // Wrap around to the beginning
        const rpcUrl = rpcUrls[index]
        console.log('rpc', rpcUrl)
        try {
          provider = new providers.StaticJsonRpcProvider(rpcUrl)
          console.log(`processing #${i}/${blockNumbers?.length}: ${blockNumber}/${endBlockNumber}`)
          console.log(blockNumber, startBlockNumber, endBlockNumber)
          // Fetch the block and its transactions
          const block = await withTimeout(provider.getBlockWithTransactions(blockNumber), 10 * 1000)
          // const block = await provider.send('eth_getBlockReceipts', [blockNumber, true])
          // console.log(block)
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

              const key = `${block.timestamp}-${tx.from.toLowerCase()}-${tx.hash}`
              const ethPriceUsd = await this.getClosestEthPriceUsd(block.timestamp)

              const value = {
                timestamp: block.timestamp,
                txHash: tx.hash,
                gasUsed: gasUsed.toString(),
                gasPrice: tx.gasPrice.toString(),
                ethPriceUsd
              }

              // Insert into LevelDB
              // await topGasSpenders.put(key, JSON.stringify(value))
              await this.db.upsertSpender({
                address: tx.from.toLowerCase(),
                ...value
              })

              if (tx.to) {
                const _key = `${block.timestamp}-${tx.to.toLowerCase()}-${tx.hash}`

                // Insert into LevelDB
                // await topGasGuzzlers.put(_key, JSON.stringify(value))
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

  async handleGetCurrentEthUsdPrice () {
    const price = await this.getEthUsdPrice()
    const priceDisplay = currencyFormatter.format(price)
    return {
      price,
      priceDisplay,
      timestamp: Math.floor(Date.now() / 1000)
    }
  }

  async handleGetGasEstimates () {
    const mapping = {
      'ETH Transfer': 21_000,
      'ERC20 Transfer': 40_000,
      'Uniswap Swap': 200_000
    }

    const estimates: any[] = []
    for (const [key, value] of Object.entries(mapping)) {
      const gasEstimate = await this.getGasEstimate(value)
      estimates.push({
        action: key,
        gasLimit: value,
        gasLimitDisplay: numbeFormatter.format(value),
        ...gasEstimate
      })
    }

    return {
      estimates
    }
  }

  getTimeRangeToSeconds (timeRange: string) {
    let minutes = 60
    if (timeRange === '10m') {
      minutes = 10
    }
    if (timeRange === '1h') {
      minutes = 60
    }
    if (timeRange === '24h') {
      minutes = 24 * 60
    }
    if (timeRange === '7d') {
      minutes = 24 * 60 * 7
    }

    return minutes * 60
  }

  async handleGetHistoricalGasPrices (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = this.getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(Date.now() / 1000)
    const endTime = currentTime
    const startTime = endTime - timeRangeSeconds
    const gasPrices = await this.getHistoricalGasPrices(startTime, endTime)
    const _gasPrices = gasPrices.map((item: any) => Number(item.gasPrice))
    // const filteredGasPrices = _gasPrices
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

    // // Create D3 scale
    // const gasPriceScale = d3.scaleLinear()
    //   .domain([sortedData[0].timestamp, sortedData[sortedData.length - 1].timestamp])
    //   .range([sortedData[0].gasPrice.gwei, sortedData[sortedData.length - 1].gasPrice.gwei])

    // // Generate 50 evenly spaced timestamps
    // const timestampIncrement = (sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp) / 49
    // const interpolatedData = Array.from({ length: 50 }, (_, i: number) => {
    //   const newTimestamp = sortedData[0].timestamp + i * timestampIncrement
    //   const gwei = gasPriceScale(newTimestamp)
    //   return {
    //     block: newTimestamp,
    //     timestamp: newTimestamp,
    //     gasPrice: {
    //       gwei,
    //       wei: formatUnits(parseUnits(Number(gwei.toString()).toFixed(9), 'gwei').toString(), 'wei')
    //     }
    //   }
    // })

    // Find the minimum and maximum timestamps
    const minTimestamp = sortedData[0].timestamp;
    const maxTimestamp = sortedData[sortedData.length - 1].timestamp;

    const totalRange = maxTimestamp - minTimestamp;
    const resampleInterval = Math.ceil(totalRange / 49); // We use 49 to make sure we include both the start and end points, making it 50 points

    // Generate an array of timestamps based on the resample interval
    const newTimestamps : any[] = [];
    for (let t = minTimestamp; t <= maxTimestamp; t += resampleInterval) {
      newTimestamps.push(t);
    }

    // Find the corresponding gasPrice for each new timestamp
    const resampledData = newTimestamps.map((newTimestamp) => {
      // Find the closest original data point to the new timestamp
      const closestPoint = sortedData.reduce((prev, curr) => {
        return Math.abs(curr.timestamp - newTimestamp) < Math.abs(prev.timestamp - newTimestamp) ? curr : prev;
      });

      return {
        block: closestPoint.block,
        timestamp: newTimestamp,
        gasPrice: {
          gwei: closestPoint.gasPrice.gwei,
          wei: formatUnits(parseUnits(Number(closestPoint.gasPrice.gwei.toString()).toFixed(9), 'gwei').toString(), 'wei')
        }
      };
    });

    return {
      // gasPrices: interpolatedData
      gasPrices: resampledData
    }
  }

  async handleGetTopGasSpenders (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = this.getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(DateTime.fromSeconds(Math.floor(Date.now() / 1000)).toUTC().startOf('minute').toSeconds())
    const gasSpenders = await this.rankAddressesForTimeRange('spenders', currentTime - timeRangeSeconds, currentTime)
    return {
      gasSpenders: gasSpenders.slice(0, 25)
    }
  }

  async handleGetTopGasGuzzlers (params: any[]) {
    const timeRange = params?.[0]?.toLowerCase()
    const timeRangeSeconds = this.getTimeRangeToSeconds(timeRange)
    const currentTime = Math.floor(DateTime.fromSeconds(Math.floor(Date.now() / 1000)).toUTC().startOf('minute').toSeconds())
    const gasGuzzlers = await this.rankAddressesForTimeRange('guzzlers', currentTime - timeRangeSeconds, currentTime)
    return {
      gasGuzzlers: gasGuzzlers.slice(0, 25)
    }
  }

  async startTopGasGuzzlersPoller () {
    const shouldSync = true
    if (shouldSync) {
      const startBlockNumber = 108419729
      const endBlockNumber = (await this.provider.getBlockNumber())
      // this.syncTopGasSpenders(startBlockNumber, endBlockNumber)
    }
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

  async handleGetCurrentGasPrice () {
    const gasPrice = await this.getGasPrice()
    return {
      gasPrice,
      timestamp: Math.floor(Date.now() / 1000)
    }
  }

  async queryTransactions (kind: string, startTimestamp: number, endTimestamp: number): Promise<any[]> {
    let items :any = []
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

  async getClosestEthPriceUsd (timestamp: number): Promise<number> {
    const price = await this.db.getClosestEthPriceUsd(timestamp)

    if (!price) {
      throw new Error("No entries found in the database, which should not happen.")
    }

    return price
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
          totalGas: totalGasEth,
          totalGasUsd: totalGasUsd,
          totalGasUsdDisplay: currencyFormatter.format(totalGasUsd)
        }
      })
      .sort((a: any, b: any) => (Number(b.totalGasUsd) - Number(a.totalGasUsd)))

    return sortedAddresses
  }
}
