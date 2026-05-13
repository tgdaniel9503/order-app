import cors from 'cors'
import express from 'express'
import { checkDatabaseConnection } from './db/pool.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cozy-order-api',
  })
})

app.get('/health/db', async (req, res, next) => {
  try {
    const result = await checkDatabaseConnection()
    res.json({
      status: 'ok',
      database: {
        connected: true,
        now: result.now,
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/menus', (req, res) => {
  res.json({
    data: [],
  })
})

app.use((req, res) => {
  res.status(404).json({
    message: '요청한 API를 찾을 수 없습니다.',
  })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    message: '서버 오류가 발생했습니다.',
  })
})

export default app
