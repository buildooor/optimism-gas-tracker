import cors from 'cors'
import corsWhitelist from '../config/corsWhitelist.json'

const corsOptions = {
  origin: function (origin: any, callback: any) {
    if (corsWhitelist.includes(origin)) {
      callback(null, true)
    } else {
      console.log('origin:', origin, 'not allowed')
      callback(new Error('Not allowed by CORS'))
    }
  }
}

export function corsMiddleware () {
  return cors(corsOptions)
}
