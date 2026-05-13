const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.message || 'API 요청 중 오류가 발생했습니다.')
  }

  return body.data
}

export const getMenus = () => fetchJson('/api/menus')

export const getAdminMenus = () => fetchJson('/api/admin/menus')

export const updateMenuStock = ({ menuId, delta }) =>
  fetchJson(`/api/menus/${menuId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ delta }),
  })

export const getOrders = () => fetchJson('/api/orders')

export const createOrder = (items) =>
  fetchJson('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })

export const advanceOrderStatus = (orderId) =>
  fetchJson(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
  })
