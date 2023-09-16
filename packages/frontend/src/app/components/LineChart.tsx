import { DateTime } from 'luxon'
import { ResponsiveLine } from '@nivo/line'
import { useResizeDetector } from 'react-resize-detector'

export function LineChart(props: any) {
  const { width, ref } = useResizeDetector()
  let { gasPrices, timeRange } = props

  if (!gasPrices.length) {
    return (
      <div
      style={{
        width: '700px',
        height: '300px',
        }}
      ></div>
    )
  }

  const data = [
  {
    id: 'linechart',
    color: '#ff0420',
    data: gasPrices.map((gasPrice: any) => {
      return {
        x: DateTime.fromSeconds(gasPrice.timestamp).toJSDate(),
        y: Number(Number(gasPrice.gasPrice.gwei).toFixed(8))
      }
    })
  }]

  const highestValue = Math.max(...gasPrices.map((gasPrice: any) => Number(gasPrice.gasPrice.gwei)))
  const lowestValue = Math.min(...gasPrices.map((gasPrice: any) => Number(gasPrice.gasPrice.gwei)))

  const maxYValue = highestValue * 1.2
  const minYValue = lowestValue * 0.8
  const isMobile = !!width && width <= 650

  let tickValues = 'every 1 hour'
  if (timeRange === '10m') {
    tickValues = isMobile ? 'every 5 minutes' : 'every 2 minutes'
  }
  if (timeRange === '1h') {
    tickValues = isMobile ? 'every 30 minutes' : 'every 10 minutes'
  }
  if (timeRange === '24h') {
    tickValues = isMobile ? 'every 12 hours' : 'every 4 hours'
  }
  if (timeRange === '7d') {
    tickValues = isMobile ? 'every 3 days' : 'every 24 hours'
  }

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        maxWidth: '700px',
        height: '300px',
      }}
    >
    <ResponsiveLine
        data={data}
        colors={['red']}
        margin={{ top: 20, right: 60, bottom: 50, left: 120 }}
        curve="monotoneX"
        xScale={{
          type: "time",
          format: "native",
          precision: "second"
        }}
        tooltip={({ point }: any) => {
          const { data: { x, y } } = point
          const dt = DateTime.fromMillis(x.getTime())
          const _x = dt.toRelative()
          return (
            <div>
              <strong>{`Time: ${_x}`}</strong>
              <br />
              <span>{`Gwei: ${y.toString()}`}</span>
            </div>
          )
        }}
        xFormat="time:%Y-%m-%d %H:%M:%S"
        yScale={{
            type: 'linear',
            min: minYValue,
            max: maxYValue,
            stacked: true,
            reverse: false
        }}
        yFormat=" >-.9f"
        axisTop={null}
        axisRight={null}
        axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value: any) => {
              const dt = DateTime.fromMillis(value.getTime())
              return dt.toRelative()
            },
            tickValues: tickValues,
            legend: '',
            legendOffset: 36,
        }}
        axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Gas Price (Gwei)',
            legendOffset: -70,
            legendPosition: 'middle',
            format: (value: any) => {
              return value.toString()
            },
        }}
        pointSize={4}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointLabelYOffset={-12}
        useMesh={true}
        legends={[]}
    />
    </div>
  )
}
