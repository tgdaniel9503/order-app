import { query } from '../db/pool.js'
import { toMenuResponse } from '../utils/formatters.js'

const buildMenuList = (rows) => {
  const menuMap = new Map()

  rows.forEach((row) => {
    if (!menuMap.has(row.id)) {
      menuMap.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        image_url: row.image_url,
        stock_quantity: row.stock_quantity,
        options: [],
      })
    }

    if (row.option_id) {
      menuMap.get(row.id).options.push({
        id: Number(row.option_id),
        name: row.option_name,
        price: row.option_price,
      })
    }
  })

  return Array.from(menuMap.values()).map((menu) => toMenuResponse(menu, menu.options))
}

export const getMenus = async ({ includeStock = false } = {}) => {
  const result = await query(`
    SELECT
      menus.id,
      menus.name,
      menus.description,
      menus.price,
      menus.image_url,
      menus.stock_quantity,
      menu_options.id AS option_id,
      menu_options.name AS option_name,
      menu_options.price AS option_price
    FROM menus
    LEFT JOIN menu_options ON menu_options.menu_id = menus.id
    ORDER BY menus.id ASC, menu_options.id ASC
  `)

  return buildMenuList(result.rows).map((menu) => {
    if (includeStock) return menu

    const { stockQuantity, stockStatus, ...publicMenu } = menu
    return publicMenu
  })
}

export const updateMenuStock = async ({ menuId, delta }) => {
  const parsedDelta = Number(delta)

  if (!Number.isInteger(parsedDelta)) {
    const error = new Error('재고 변경 수량은 정수여야 합니다.')
    error.status = 400
    throw error
  }

  const result = await query(
    `
      UPDATE menus
      SET stock_quantity = stock_quantity + $1,
          updated_at = NOW()
      WHERE id = $2
        AND stock_quantity + $1 >= 0
      RETURNING *
    `,
    [parsedDelta, menuId],
  )

  if (result.rowCount === 0) {
    const error = new Error('메뉴를 찾을 수 없거나 재고가 부족합니다.')
    error.status = 400
    throw error
  }

  return toMenuResponse(result.rows[0])
}
