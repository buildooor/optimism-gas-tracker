import { OsStats } from '../OsStats'
import { actionHandler, root } from './shared'
import { server, worker } from '../server'

export const workerProgram = root
  .command('server')
  .description('Start the server')
  .action(actionHandler(main))

async function main (source: any) {
  console.log('starting server')

  const osStats = new OsStats()

  worker()
  server()
  await osStats.start()
}
