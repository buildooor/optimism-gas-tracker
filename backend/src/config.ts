import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

export const port = Number(process.env.PORT ?? 8000)
export const network = process.env.NETWORK ?? 'goerli'
export const logBatchSize = Number(process.env.LOG_BATCH_SIZE ?? 2000)
export const rpcUrls: any = {
  ethereum: process.env.ETHEREUM_RPC,
  optimism: process.env.OPTIMISM_RPC,
}
export const dbPath = process.env.DB_PATH ?? path.resolve(__dirname, '../db')
