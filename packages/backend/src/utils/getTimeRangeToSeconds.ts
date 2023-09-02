export function getTimeRangeToSeconds (timeRange: string) {
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
