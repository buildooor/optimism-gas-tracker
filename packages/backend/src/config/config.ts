import dotenv from 'dotenv'
import path from 'path'
dotenv.config()

export const port = Number(process.env.PORT ?? 8000)
export const rpcUrls: any = {
  ethereum: process.env.ETHEREUM_RPC,
  optimism: process.env.OPTIMISM_RPC
}
export const dbPath = process.env.DB_PATH ?? path.resolve(__dirname, '../db')
export const postgresConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DBNAME || 'postgres',
  password: process.env.POSTGRES_PASS || 'password',
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
  maxConnections: process.env.POSTGRES_MAX_CONNECTIONS ? parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 10) : 10
}
