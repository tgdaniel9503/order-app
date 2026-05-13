export const getStockStatus = (stockQuantity) => {
  if (stockQuantity === 0) return '품절'
  if (stockQuantity < 5) return '주의'
  return '정상'
}

export const toMenuResponse = (row, options = []) => ({
  id: Number(row.id),
  name: row.name,
  description: row.description,
  price: row.price,
  imageUrl: row.image_url,
  stockQuantity: row.stock_quantity,
  stockStatus: getStockStatus(row.stock_quantity),
  options,
})

export const toOrderResponse = (order, items = []) => ({
  id: Number(order.id),
  orderedAt: order.ordered_at,
  status: order.status,
  totalAmount: order.total_amount,
  summary: items
    .map((item) => `${item.menuName} x ${item.quantity}`)
    .join(', '),
  items,
})
