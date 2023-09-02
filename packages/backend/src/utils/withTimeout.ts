export async function withTimeout (promise: any, ms: number) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timedout')), ms)
  )
  return Promise.race([promise, timeout])
}
