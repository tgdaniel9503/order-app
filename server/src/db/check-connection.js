import 'dotenv/config'
import { checkDatabaseConnection, pool } from './pool.js'

try {
  const result = await checkDatabaseConnection()
  console.log(`Database connection ok: ${result.now.toISOString()}`)
} catch (error) {
  console.error('Database connection failed')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
