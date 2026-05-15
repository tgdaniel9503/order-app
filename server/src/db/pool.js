import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경 변수가 설정되어 있지 않습니다.')
}

const connectionString = process.env.DATABASE_URL
const needsSsl =
  connectionString.includes('render.com') ||
  connectionString.includes('sslmode=require')

export const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
})

export const query = (text, params) => pool.query(text, params)

export const checkDatabaseConnection = async () => {
  const result = await query('SELECT NOW() AS now')
  return result.rows[0]
}
