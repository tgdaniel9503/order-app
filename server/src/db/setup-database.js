import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, query } from './pool.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

try {
  const schemaSql = await readFile(join(currentDir, 'schema.sql'), 'utf8')
  const seedSql = await readFile(join(currentDir, 'seed.sql'), 'utf8')

  await query(schemaSql)
  await query(seedSql)

  console.log('Database schema and seed data are ready')
} catch (error) {
  console.error('Database setup failed')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
