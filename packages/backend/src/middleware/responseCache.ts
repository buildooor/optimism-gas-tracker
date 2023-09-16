import mcache from 'memory-cache'

export function responseCache (req: any, res: any, next: any) {
  let durationMs = 10 * 1000
  const urlKey = req.originalUrl || req.url
  const paramsKey = req.body ? JSON.stringify(req.body) : ''
  const key = `__express__${urlKey}::${paramsKey}}`
  if (key.includes('"1h"')) {
    durationMs = 5 * 60 * 1000
  }
  if (key.includes('"7d"')) {
    durationMs = 60 * 60 * 1000
  }
  if (key.includes('"24h"')) {
    durationMs = 10 * 60 * 1000
  }
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
