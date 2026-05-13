import 'dotenv/config'
import pg from 'pg'

const { Client } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경 변수가 설정되어 있지 않습니다.')
}

const targetUrl = new URL(process.env.DATABASE_URL)
const databaseName = targetUrl.pathname.replace('/', '')

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('데이터베이스 이름은 영문, 숫자, 밑줄만 사용할 수 있습니다.')
}

const adminUrl = new URL(process.env.DATABASE_URL)
adminUrl.pathname = '/postgres'

const client = new Client({
  connectionString: adminUrl.toString(),
})

try {
  await client.connect()

  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    databaseName,
  ])

  if (existing.rowCount > 0) {
    console.log(`Database already exists: ${databaseName}`)
  } else {
    await client.query(`CREATE DATABASE "${databaseName}"`)
    console.log(`Database created: ${databaseName}`)
  }
} catch (error) {
  console.error('Database creation failed')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
