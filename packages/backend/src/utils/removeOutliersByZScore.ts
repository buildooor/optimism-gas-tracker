export function removeOutliersByZScore (data: number[], threshold = 2) {
  const mean = data.reduce((acc, val) => acc + val, 0) / data.length
  const stdDev = Math.sqrt(data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length)

  return data.filter((val) => Math.abs((val - mean) / stdDev) < threshold)
}
