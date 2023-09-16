import rateLimit from 'express-rate-limit'
import { ipRateLimitReqPerWindow, ipRateLimitWindowMs } from '../config'

export const rateLimitMiddleware = rateLimit({
  windowMs: ipRateLimitWindowMs,
  max: ipRateLimitReqPerWindow,
  message: 'Too many attempts from your IP address. Please wait a few seconds.',
  keyGenerator: (req) => {
    return req.ip
  }
})
