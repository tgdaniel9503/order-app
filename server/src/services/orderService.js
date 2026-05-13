import { pool, query } from '../db/pool.js'
import { toOrderResponse } from '../utils/formatters.js'

const nextStatusByCurrent = {
  pending: 'preparing',
  preparing: 'done',
}

const getOrderItems = async (orderIds) => {
  if (!orderIds.length) return new Map()

  const result = await query(
    `
      SELECT
        order_items.id,
        order_items.order_id,
        order_items.menu_id,
        order_items.menu_name,
        order_items.unit_price,
        order_items.quantity,
        order_items.line_amount,
        COALESCE(
          json_agg(
            json_build_object(
              'id', order_item_options.option_id,
              'name', order_item_options.option_name,
              'price', order_item_options.option_price
            )
          ) FILTER (WHERE order_item_options.id IS NOT NULL),
          '[]'
        ) AS options
      FROM order_items
      LEFT JOIN order_item_options ON order_item_options.order_item_id = order_items.id
      WHERE order_items.order_id = ANY($1::bigint[])
      GROUP BY order_items.id
      ORDER BY order_items.id ASC
    `,
    [orderIds],
  )

  return result.rows.reduce((map, row) => {
    const orderId = String(row.order_id)
    const item = {
      id: Number(row.id),
      menuId: Number(row.menu_id),
      menuName: row.menu_name,
      unitPrice: row.unit_price,
      quantity: row.quantity,
      lineAmount: row.line_amount,
      options: row.options,
    }

    if (!map.has(orderId)) {
      map.set(orderId, [])
    }
    map.get(orderId).push(item)
    return map
  }, new Map())
}

export const getOrders = async () => {
  const result = await query(`
    SELECT *
    FROM orders
    ORDER BY ordered_at DESC, id DESC
  `)

  const itemsByOrderId = await getOrderItems(result.rows.map((order) => order.id))

  return result.rows.map((order) =>
    toOrderResponse(order, itemsByOrderId.get(String(order.id)) ?? []),
  )
}

export const getOrderById = async (orderId) => {
  const result = await query('SELECT * FROM orders WHERE id = $1', [orderId])

  if (result.rowCount === 0) {
    const error = new Error('주문 정보를 찾을 수 없습니다.')
    error.status = 404
    throw error
  }

  const itemsByOrderId = await getOrderItems([orderId])
  return toOrderResponse(result.rows[0], itemsByOrderId.get(String(orderId)) ?? [])
}

export const createOrder = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('주문 항목이 필요합니다.')
    error.status = 400
    throw error
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const normalizedItems = items.map((item) => ({
      menuId: Number(item.menuId),
      quantity: Number(item.quantity),
      optionIds: Array.isArray(item.optionIds) ? item.optionIds.map(Number) : [],
    }))

    normalizedItems.forEach((item) => {
      if (!Number.isInteger(item.menuId) || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        const error = new Error('주문 항목의 메뉴와 수량을 확인해 주세요.')
        error.status = 400
        throw error
      }
    })

    const menuIds = [...new Set(normalizedItems.map((item) => item.menuId))]
    const menuResult = await client.query(
      'SELECT * FROM menus WHERE id = ANY($1::bigint[]) FOR UPDATE',
      [menuIds],
    )
    const menus = new Map(menuResult.rows.map((menu) => [Number(menu.id), menu]))

    const optionIds = [...new Set(normalizedItems.flatMap((item) => item.optionIds))]
    const optionResult = optionIds.length
      ? await client.query('SELECT * FROM menu_options WHERE id = ANY($1::bigint[])', [optionIds])
      : { rows: [] }
    const options = new Map(optionResult.rows.map((option) => [Number(option.id), option]))

    const requiredStockByMenuId = normalizedItems.reduce((map, item) => {
      map.set(item.menuId, (map.get(item.menuId) ?? 0) + item.quantity)
      return map
    }, new Map())

    for (const [menuId, requiredQuantity] of requiredStockByMenuId) {
      const menu = menus.get(menuId)
      if (!menu) {
        const error = new Error('존재하지 않는 메뉴가 포함되어 있습니다.')
        error.status = 400
        throw error
      }

      if (menu.stock_quantity < requiredQuantity) {
        const error = new Error(`${menu.name} 재고가 부족합니다.`)
        error.status = 409
        throw error
      }
    }

    const orderLines = normalizedItems.map((item) => {
      const menu = menus.get(item.menuId)
      const selectedOptions = item.optionIds.map((optionId) => {
        const option = options.get(optionId)
        if (!option || Number(option.menu_id) !== item.menuId) {
          const error = new Error('메뉴에 연결되지 않은 옵션이 포함되어 있습니다.')
          error.status = 400
          throw error
        }
        return option
      })

      const optionTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0)
      const unitPrice = menu.price + optionTotal

      return {
        menu,
        selectedOptions,
        quantity: item.quantity,
        unitPrice,
        lineAmount: unitPrice * item.quantity,
      }
    })

    const totalAmount = orderLines.reduce((sum, item) => sum + item.lineAmount, 0)
    const orderResult = await client.query(
      'INSERT INTO orders (total_amount) VALUES ($1) RETURNING *',
      [totalAmount],
    )
    const order = orderResult.rows[0]

    for (const line of orderLines) {
      const itemResult = await client.query(
        `
          INSERT INTO order_items (order_id, menu_id, menu_name, unit_price, quantity, line_amount)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          order.id,
          line.menu.id,
          line.menu.name,
          line.unitPrice,
          line.quantity,
          line.lineAmount,
        ],
      )

      for (const option of line.selectedOptions) {
        await client.query(
          `
            INSERT INTO order_item_options (order_item_id, option_id, option_name, option_price)
            VALUES ($1, $2, $3, $4)
          `,
          [itemResult.rows[0].id, option.id, option.name, option.price],
        )
      }
    }

    for (const [menuId, requiredQuantity] of requiredStockByMenuId) {
      await client.query(
        `
          UPDATE menus
          SET stock_quantity = stock_quantity - $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [requiredQuantity, menuId],
      )
    }

    await client.query('COMMIT')
    return getOrderById(order.id)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const advanceOrderStatus = async (orderId) => {
  const result = await query('SELECT * FROM orders WHERE id = $1', [orderId])

  if (result.rowCount === 0) {
    const error = new Error('주문 정보를 찾을 수 없습니다.')
    error.status = 404
    throw error
  }

  const currentOrder = result.rows[0]
  const nextStatus = nextStatusByCurrent[currentOrder.status]

  if (!nextStatus) {
    const error = new Error('이미 완료된 주문입니다.')
    error.status = 400
    throw error
  }

  await query(
    `
      UPDATE orders
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [nextStatus, orderId],
  )

  return getOrderById(orderId)
}
