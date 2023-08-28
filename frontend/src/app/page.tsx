'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import styles from './page.module.css'
import { DateTime } from 'luxon'
import { LineChart } from './components/LineChart'
import { useInterval } from 'react-use'
import { useQuery } from 'react-query'
import { QueryClient, QueryClientProvider } from 'react-query';
import Skeleton from '@mui/material/Skeleton'

const refreshInterval = 10 * 1000
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const Countdown = ({ initialCount = 10 }) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Set up the countdown timer
    const timerId = setTimeout(() => {
      // Reset the counter if it reaches zero
      if (count === 0) {
        setCount(initialCount);
      } else {
        setCount(count - 1);
      }
    }, 1000);

    // Clear the timer when the component unmounts or updates
    return () => clearTimeout(timerId);
  }, [count, initialCount]);

  return (
    <div>
      {`Next update in ${count}s`}
    </div>
  );
};

const GasTable = (props: any) => {
  const { title, subtitle, gasData } = props
  return (
    <div className={styles.GasTable}>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Address</th>
            <th>Gas Used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {!gasData?.length && (
            [1,2,3].map((_, i: number) => {
              return (
                <tr key={i}>
                  <td>
                    <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(0, 0, 0, .1)' }} width="100%" height={30} />
                  </td>
                  <td>
                    <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(0, 0, 0, .1)' }} width="100%" height={30} />
                  </td>
                  <td>
                    <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(0, 0, 0, .1)' }} width="100%" height={30} />
                  </td>
                  <td>
                    <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(0, 0, 0, .1)' }} width="100%" height={30} />
                  </td>
                </tr>
              )
            })
          )}
          {gasData.map((item: any, index: number) => {
            const explorerUrl = `https://optimistic.etherscan.io/address/${item.address}`
            return (
              <tr key={item.address}>
                <td className={styles.rank}>
                  {index === 0 ? '🥇' : ''}
                  {index === 1 ? '🥈' : ''}
                  {index === 2 ? '🥉' : ''}
                  {index + 1}
                </td>
                <td><a href={explorerUrl} target="_blank">{item.address}</a></td>
                <td>{item.totalGasUsdDisplay}</td>
                <td>Ξ{Number(Number(item.totalGas)?.toFixed(5))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function useDate() {
  const { isLoading, data, error } = useQuery(['date'], async () => {
    const dt = DateTime.utc()
    const formattedDate = dt.toFormat('ccc, dd LLL yyyy HH:mm:ss \'UTC\'')
    return formattedDate
  }, {
    enabled: true,
    refetchInterval: 1 * 1000
  })

  return {
    date: data ?? ''
  }
}

function useRelativeDate(timestamp: number) {
  const { isLoading, data, error } = useQuery([`relativedate:${timestamp}`, timestamp], async () => {
    if (!timestamp) {
      return ''
    }
    return DateTime.fromSeconds(timestamp).toRelative()
  }, {
    enabled: true,
    refetchInterval: 1 * 1000
  })

  return {
    date: data ?? ''
  }
}

function useGasEstimates() {
  const { isLoading, data, error } = useQuery(['gasEstimates'], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getGasEstimates',
        params: [],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result.estimates)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    estimates: data ?? []
  }
}

function useTimeRange(defaultValue: string) {
  const [timeRange, setTimeRange] = useState(defaultValue)
  return {
    timeRange,
    setTimeRange
  }
}

function useGasPrices(timeRange: string) {
  const { isLoading, data, error } = useQuery(['gasPrices', timeRange], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getHistoricalGasPrices',
        params: [timeRange],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result.gasPrices)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    gasPrices: data ?? []
  }
}

function useTopGasSpenders (timeRange: string) {
  const { isLoading, data, error } = useQuery(['topGasSpenders', [timeRange]], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getTopGasSpenders',
        params: [timeRange],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result.gasSpenders)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    topGasSpenders: data ?? []
  }
}

function useTopGasGuzzlers(timeRange: string) {
  const { isLoading, data, error } = useQuery(['topGasGuzzlers', timeRange], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getTopGasGuzzlers',
        params: [timeRange],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result.gasGuzzlers)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    topGasGuzzlers: data ?? []
  }
}

function useGetCurrentEthUsdPrice() {
  const { isLoading, data, error } = useQuery(['currentEthUsdPrice'], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getCurrentEthUsdPrice',
        params: [],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    price: data?.price,
    priceDisplay: data?.priceDisplay,
    timestamp: data?.timestamp,
  }
}

function useGetCurrentGasPrice() {
  const { isLoading, data, error } = useQuery(['currentGasPrice'], async () => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'gasTracker_getCurrentGasPrice',
        params: [],
        id: 1
      })
    })
    .then(response => response.json())
    .then((data: any) => data.result)
  }, {
    enabled: true,
    refetchInterval: refreshInterval
  })

  return {
    gasPrice: data?.gasPrice,
    timestamp: data?.timestamp,
  }
}

function Header () {
  return (
    <div className={styles.titleContainer}>
      <a href={"/"}><Image src="/assets/optimism.svg" alt="" width={200} height={40} /> <span className={styles.title}>Gas Tracker ⛽</span></a>
    </div>
  )
}

function SubHeader (props: any) {
  const { blockInfo } = props
  const { date } = useDate()
  return (
    <div className={styles.subTitleContainer}>
      {/*<Countdown initialCount={refreshInterval / 1000} />*/}
      <BlockInfo blockNumber={blockInfo?.block} gasPrice={blockInfo?.gasPrice} />
      <div title="Current date and time in UTC">{date}</div>
    </div>
  )
}

function GasEstimates () {
  const { estimates } = useGasEstimates()
  console.log(estimates)

  return (
    <div className={styles.gasEstimates}>
      <div className={styles.gasEstimatesHeader}>Estimated Cost of Transaction Actions:</div>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Estimated Cost</th>
            <th></th>
            <th>Gas Limit</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((item: any, index: number) => (
            <tr key={index}>
              <td>{item.action}</td>
              <td>{item.usdDisplay}</td>
              <td>Ξ{Number(Number(item.eth)?.toFixed(5))}</td>
              <td title={`Based on ${item.gasLimit} gas limit`}>{item.gasLimitDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PriceBoxes (props: any) {
  const { priceDisplay, gasPrice, priceTimestamp, gasPriceTimestamp } = props
  const { date: lastUpdatedGasPriceTimestamp } = useRelativeDate(gasPriceTimestamp)
  const { date: lastUpdatedPriceTimestamp } = useRelativeDate(priceTimestamp)

  return (
    <div className={styles.boxesContainer}>
      <div className={styles.boxes}>
        <div className={styles.box}>
          <div title="Current gas price" className={styles.boxHeader}>Gas Price</div>
          <div title="Current gas price denominated in Gwei" className={styles.boxContent}>
            {gasPrice?.gwei ? (
              <>{gasPrice?.gwei} gwei</>
            ) : (
              <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(255, 255, 255, .1)' }} width="100%" height={30} />
            )}
          </div>
          <div title="Current gas price denominated in Wei" className={styles.boxContentSmall}>
            {gasPrice?.wei ? (
              <>{gasPrice?.wei} wei</>
            ) : (
              <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(255, 255, 255, .1)' }} width="100px" height={20} />
            )}
            </div>
            {!!gasPriceTimestamp && (
              <div title="Last updated" className={styles.boxLastUpdated}>
                Last updated {lastUpdatedGasPriceTimestamp}
              </div>
            )}
          </div>
        <div className={styles.box}>
          <div title="Current ETH Price in USD" className={styles.boxHeader}>ETH Price</div>
          <div title="Current ETH Price in USD" className={styles.boxContent}>
            {priceDisplay ? (
              <>{priceDisplay}</>
            ) : (
              <Skeleton variant="rounded" sx={{ bgcolor: 'rgba(255, 255, 255, .1)' }} width="160px" height={30} />
            )}
            </div>
            {!!priceTimestamp && (
              <div title="Last updated" className={styles.boxLastUpdated}>
                Last updated {lastUpdatedPriceTimestamp}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

function TimeRange (props: any) {
  const { onChange, timeRange } = props
  let readableTimeRange = ''
  if (timeRange === '10m') {
    readableTimeRange = '10 minutes'
  }
  if (timeRange === '1h') {
    readableTimeRange = 'hour'
  }
  if (timeRange === '24h') {
    readableTimeRange = '24 hours'
  }
  if (timeRange === '7d') {
    readableTimeRange = '7 days'
  }
  return (
    <div className={styles.timeRangeContainer}>
      <div title="Time range for data shown">Last {readableTimeRange}</div>
      <div className={styles.timeRange}>
        <button title="10 minutes" className={timeRange === '10m' ? styles.timeRangeButtonSelected : styles.timeRangeButton} onClick={() => onChange('10m')}>10m</button>
        <button title="1 hour" className={timeRange === '1h' ? styles.timeRangeButtonSelected : styles.timeRangeButton} onClick={() => onChange('1h')}>1H</button>
        <button disabled title="24 hours (NOT ENOUGH DATA YET)" className={timeRange === '24h' ? styles.timeRangeButtonSelected : styles.timeRangeButton} onClick={() => onChange('24h')}>24H</button>
        <button disabled title="7 days (NOT ENOUGH DATA YET)" className={timeRange === '7d' ? styles.timeRangeButtonSelected : styles.timeRangeButton} onClick={() => onChange('7d')}>7D</button>
      </div>
    </div>
  )
}

function TableTab(props: any) {
  const { title, subtitle, blockNumber, selected } = props
  return (
    <div className={selected ? styles.tableTabSelected : styles.tableTab}>
      <h2 className={styles.tableTabTitle}>⛽ {title}</h2>
      <div className={styles.tableTabSubtitle}>{subtitle}</div>
      <div className={styles.lastUpdatedBlock}>Last updated block {blockNumber}</div>
    </div>
  )
}


function BlockInfo (props: any) {
  const { blockNumber, gasPrice } = props
  return (
    <div className={styles.blockInfo}>
      {!!gasPrice?.gwei && (
        <div className={styles.blockInfoGasPrice} title="Latest gas price denominated in Gwei">Gas Price: {gasPrice?.gwei} gwei</div>
      )}
      {!!blockNumber && (
        <div className={styles.blockInfoBlock} title="Block number of gas price shown">
          <a href={`https://optimistic.etherscan.io/block/${blockNumber}`} target="_blank">Last updated block {blockNumber}</a>
        </div>
      )}
    </div>
  )
}

function Footer () {
  return (
      <footer className={styles.footer}>
        <div className={styles.footerOptimism}>
          <span>Powered by</span> <a href="https://www.optimism.io/" target="_blank"><Image src="/assets/optimism.svg" alt="" width={135} height={25} /> <span>Mainnet</span></a></div>
        <div className={styles.footerLinks}>
          <div className={styles.copyright}>© {new Date().getFullYear()}</div>
          <em><a href="https://github.com/buildooor" target="_blank">Built by a buildooooor</a></em>
        </div>
      </footer>
  )
}

function Banner () {
  return (
    <div className={styles.banner}>
      <div className={styles.innerBanner}>
        {'⚠️ This project is still in development.'}
      </div>
    </div>
  )
}

function Main() {
  const { timeRange, setTimeRange } = useTimeRange('10m')
  const { timeRange: tableTimeRange, setTimeRange: setTableTimeRange } = useTimeRange('1h')
  const { gasPrices } = useGasPrices(timeRange)
  const { priceDisplay, timestamp: priceTimestamp } = useGetCurrentEthUsdPrice()
  const { gasPrice, timestamp: gasPriceTimestamp } = useGetCurrentGasPrice()
  const { topGasSpenders } = useTopGasSpenders(tableTimeRange)
  const { topGasGuzzlers } = useTopGasGuzzlers(tableTimeRange)
  const [activeTab, setActiveTab] = useState('tab1');
  const blockInfo = gasPrices?.[gasPrices?.length - 1]
  const topGasGuzzlersBlockNumber = blockInfo?.block
  const topGasSpendersBlockNumber = blockInfo?.block

  return (
    <main className={styles.main}>
      <Banner />
      <Header />
      <SubHeader blockInfo={blockInfo} />
      <div style={{ 'paddingLeft': '2rem', width: '100%', 'maxWidth': '600px' }}>
        <TimeRange onChange={setTimeRange} timeRange={timeRange} />
      </div>
      <LineChart timeRange={timeRange} gasPrices={gasPrices} />
      <PriceBoxes priceDisplay={priceDisplay} gasPrice={gasPrice} priceTimestamp={priceTimestamp} gasPriceTimestamp={gasPriceTimestamp} />
      <GasEstimates />
      <div className={styles.tableTabsContainer}>
        <div className={styles.tableTabs}>
          <div onClick={event => setActiveTab('tab1')}>
            <TableTab selected={activeTab === 'tab1'} title="Top Gas Guzzlers" subtitle={"Sending Accounts that pay a lot of Gas"} blockNumber={topGasGuzzlersBlockNumber} />
          </div>
          <div onClick={event => setActiveTab('tab2')}>
            <TableTab selected={activeTab === 'tab2'} title="Top Gas Spenders" subtitle={"Contracts / Accounts that consume a lot of Gas"} blockNumber={topGasSpendersBlockNumber} />
          </div>
        </div>
      </div>
      <div style={{ width: '100%', 'maxWidth': '740px', 'marginBottom': '0.5rem' }}>
        <TimeRange onChange={setTableTimeRange} timeRange={tableTimeRange} />
      </div>
      <div className={styles.gasTableContainer}>
        {activeTab === 'tab1' && (
          <GasTable gasData={topGasGuzzlers} />
        )}
        {activeTab === 'tab2' && (
          <GasTable gasData={topGasSpenders} />
        )}
      </div>
      <div className={styles.infoFooter}>
      Gas refers to the fee required to successfully conduct a transaction on the Ethereum blockchain. Gas fees are paid in Ether (ETH) and denominated in Gwei.
      </div>
      <Footer />
    </main>
  )
}

export default function Home() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <Main />
    </QueryClientProvider>
  )
}
