import express from 'express'
import { Controller } from './controllers/MainController'
import { corsMiddleware } from './middleware/corsMiddleware'
import { port } from './config'
import { responseCache } from './middleware/responseCache'

const app = express()

app.enable('trust proxy')
app.use(corsMiddleware())
app.use(express.json({ limit: '500kb' }))
app.use(express.urlencoded({ extended: false, limit: '500kb', parameterLimit: 50 }))

const controller = new Controller()

app.get('/', (req: any, res: any) => {
  try {
    res.status(200).json({ status: 'ok' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/', responseCache, async (req: any, res: any) => {
  try {
    // console.log(req.body)
    const result = await controller.handleRequest(req.body)
    const response = {
      jsonrpc: '2.0',
      id: req.body.id,
      result: result
    }
    // console.log(JSON.stringify(response))
    res.status(200).json(response)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/health', (req: any, res: any) => {
  res.status(200).json({ status: 'ok' })
})

export async function worker () {
  await Promise.all([
    controller.startGasPricePoller(),
    controller.startTopGasGuzzlersPoller()
  ])
}

export function server () {
  const host = '0.0.0.0'
  app.listen(port, host, () => {
    console.log(`Listening on port ${port}`)
  })
}

export { app }
