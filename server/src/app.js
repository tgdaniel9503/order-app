import cors from 'cors'
import express from 'express'
import { checkDatabaseConnection } from './db/pool.js'
import { getMenus, updateMenuStock } from './services/menuService.js'
import { advanceOrderStatus, createOrder, getOrderById, getOrders } from './services/orderService.js'

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

app.get('/api/menus', async (req, res, next) => {
  try {
    const menus = await getMenus()
    res.json({ data: menus })
  } catch (error) {
    next(error)
  }
})

app.get('/api/admin/menus', async (req, res, next) => {
  try {
    const menus = await getMenus({ includeStock: true })
    res.json({ data: menus })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/menus/:menuId/stock', async (req, res, next) => {
  try {
    const menu = await updateMenuStock({
      menuId: req.params.menuId,
      delta: req.body.delta,
    })
    res.json({ data: menu })
  } catch (error) {
    next(error)
  }
})

app.get('/api/orders', async (req, res, next) => {
  try {
    const orders = await getOrders()
    res.json({ data: orders })
  } catch (error) {
    next(error)
  }
})

app.post('/api/orders', async (req, res, next) => {
  try {
    const order = await createOrder(req.body.items)
    res.status(201).json({ data: order })
  } catch (error) {
    next(error)
  }
})

app.get('/api/orders/:orderId', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.orderId)
    res.json({ data: order })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/orders/:orderId/status', async (req, res, next) => {
  try {
    const order = await advanceOrderStatus(req.params.orderId)
    res.json({ data: order })
  } catch (error) {
    next(error)
  }
})

app.use((req, res) => {
  res.status(404).json({
    message: '요청한 API를 찾을 수 없습니다.',
  })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    message: err.status ? err.message : '서버 오류가 발생했습니다.',
  })
})

export default app
