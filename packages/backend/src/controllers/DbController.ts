import pgp from 'pg-promise'
import { postgresConfig } from '../config'
import { v4 as uuid } from 'uuid'

const argv = require('minimist')(process.argv.slice(2))

export class DbController {
  db: any

  constructor () {
    const initOptions: any = {}
    const maxConnections = postgresConfig.maxConnections
    const opts = {
      max: maxConnections
    }

    const db = pgp(initOptions)({ ...postgresConfig, ...opts })
    this.db = db
    this.init().catch(console.error).then(() => {
      console.log('db init done')
    })
  }

  async init () {
    const resetDb = argv.reset
    if (resetDb) {
      await this.db.query('DROP TABLE IF EXISTS spenders')
      await this.db.query('DROP TABLE IF EXISTS guzzlers')
      await this.db.query('DROP TABLE IF EXISTS gas_prices')
    }

    const migration = argv.migration
    if (migration) {
      // await this.db.query(`
      //   ALTER TABLE spenders ADD COLUMN IF NOT EXISTS test BOOLEAN
      // `)
    }

    await this.db.query(`CREATE TABLE IF NOT EXISTS spenders (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        address TEXT NOT NULL,
        gas_used INTEGER NOT NULL,
        gas_price NUMERIC NOT NULL,
        eth_price_usd REAL NOT NULL
    )`)

    await this.db.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_spenders_address_tx_hash ON spenders (address, tx_hash);'
    )

    await this.db.query(`CREATE TABLE IF NOT EXISTS guzzlers (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        address TEXT NOT NULL,
        gas_used INTEGER NOT NULL,
        gas_price NUMERIC NOT NULL,
        eth_price_usd REAL NOT NULL
    )`)

    await this.db.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_guzzlers_address_tx_hash ON guzzlers (address, tx_hash);'
    )

    await this.db.query(`CREATE TABLE IF NOT EXISTS gas_prices (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        gas_price NUMERIC NOT NULL,
        eth_price_usd REAL NOT NULL
    )`)

    await this.db.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_gas_prices_block_number ON gas_prices (block_number);'
    )
  }

  async getSpenders (opts: any = {}) {
    const { startTimestamp, endTimestamp, limit, offset } = opts
    return this.db.any(
      'SELECT timestamp, tx_hash as "txHash", address, gas_used as "gasUsed", gas_price as "gasPrice", eth_price_usd as "ethPriceUsd" FROM spenders WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC OFFSET $4', [startTimestamp, endTimestamp, limit, offset])
  }

  async upsertSpender (item: any) {
    const { timestamp, txHash, address, gasUsed, gasPrice, ethPriceUsd } = item
    const args = [uuid(), timestamp, txHash, address, gasUsed, gasPrice, ethPriceUsd]
    await this.db.query(
      'INSERT INTO spenders (id, timestamp, tx_hash, address, gas_used, gas_price, eth_price_usd) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (address, tx_hash) DO UPDATE SET gas_used = $5, gas_price = $6, eth_price_usd = $7', args
    )
  }

  async getGuzzlers (opts: any = {}) {
    const { startTimestamp, endTimestamp, limit, offset } = opts
    return this.db.any(
      'SELECT timestamp, tx_hash as "txHash", address, gas_used as "gasUsed", gas_price as "gasPrice", eth_price_usd as "ethPriceUsd" FROM guzzlers WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC OFFSET $4', [startTimestamp, endTimestamp, limit, offset])
  }

  async upsertGuzzler (item: any) {
    const { timestamp, txHash, address, gasUsed, gasPrice, ethPriceUsd } = item
    const args = [uuid(), timestamp, txHash, address, gasUsed, gasPrice, ethPriceUsd]
    await this.db.query(
      'INSERT INTO guzzlers (id, timestamp, tx_hash, address, gas_used, gas_price, eth_price_usd) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (address, tx_hash) DO UPDATE SET gas_used = $5, gas_price = $6, eth_price_usd = $7', args
    )
  }

  async getGasPrices (opts: any = {}) {
    const { startTimestamp, endTimestamp, limit, offset } = opts
    return this.db.any(
      'SELECT timestamp, block_number as "blockNumber", gas_price as "gasPrice", eth_price_usd as "ethPriceUsd" FROM gas_prices WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC OFFSET $4', [startTimestamp, endTimestamp, limit, offset])
  }

  async upsertGasPrice (item: any) {
    const { timestamp, blockNumber, gasPrice, ethPriceUsd } = item
    const args = [uuid(), timestamp, blockNumber, gasPrice, ethPriceUsd]
    await this.db.query(
      'INSERT INTO gas_prices (id, timestamp, block_number, gas_price, eth_price_usd) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (block_number) DO UPDATE SET gas_price = $4, eth_price_usd = $5', args
    )
  }

  async getClosestEthPriceUsd (timestamp: number) {
    const result = await this.db.any(
      'SELECT eth_price_usd as "ethPriceUsd" FROM gas_prices ORDER BY ABS(timestamp - $1) LIMIT 1', [timestamp])

    if (result.length === 0) {
      return null
    }

    return result[0].ethPriceUsd || null
  }
}
