import mcache from 'memory-cache'

const durationMs = 5 * 1000

export function responseCache (req: any, res: any, next: any) {
  const urlKey = req.originalUrl || req.url
  const paramsKey = req.body ? JSON.stringify(req.body) : ''
  const key = `__express__${urlKey}::${paramsKey}}`
  const cachedBody = mcache.get(key)
  if (cachedBody) {
    res.send(cachedBody)
    return
  }

  res.sendResponse = res.send
  res.send = (body: any) => {
    mcache.put(key, body, durationMs)
    res.sendResponse(body)
  }

  next()
}
