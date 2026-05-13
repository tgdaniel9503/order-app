import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { getStockStatus } from './utils/stockStatus'

const menus = [
  {
    id: 1,
    name: '아메리카노(ICE)',
    description: '시원하고 깔끔한 풍미의 아이스 아메리카노',
    price: 4000,
    imageUrl: '/images/americano-ice.png',
    options: [
      { id: 1, name: '샷 추가', price: 500 },
      { id: 2, name: '시럽 추가', price: 0 },
    ],
  },
]

let adminMenus = []
let orders = []

const jsonResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
})

describe('order app behavior', () => {
  beforeEach(() => {
    adminMenus = [{ ...menus[0], stockQuantity: 10, stockStatus: '정상' }]
    orders = [
      {
        id: 1,
        orderedAt: '2026-05-13T06:00:00.000Z',
        status: 'pending',
        totalAmount: 4000,
        summary: '아메리카노(ICE) x 1',
        items: [],
      },
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const { pathname } = new URL(url)
        const method = options.method || 'GET'

        if (pathname === '/api/menus') {
          return jsonResponse({ data: menus })
        }

        if (pathname === '/api/admin/menus') {
          return jsonResponse({ data: adminMenus })
        }

        if (pathname === '/api/orders' && method === 'GET') {
          return jsonResponse({ data: orders })
        }

        if (pathname === '/api/orders' && method === 'POST') {
          adminMenus = [{ ...adminMenus[0], stockQuantity: 8, stockStatus: '정상' }]
          return jsonResponse({ data: { ...orders[0], id: 2 } })
        }

        if (pathname === '/api/orders/1/status') {
          orders = [{ ...orders[0], status: 'preparing' }]
          return jsonResponse({ data: orders[0] })
        }

        return jsonResponse({ message: 'not found' }, false)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns expected stock status by quantity', () => {
    expect(getStockStatus(10)).toBe('정상')
    expect(getStockStatus(3)).toBe('주의')
    expect(getStockStatus(0)).toBe('품절')
  })

  it('merges same cart item and increments quantity', async () => {
    render(<App />)

    const addButtons = await screen.findAllByRole('button', { name: '담기' })
    fireEvent.click(addButtons[0])
    fireEvent.click(addButtons[0])

    expect(screen.getByText('x 2')).toBeInTheDocument()
    expect(screen.getAllByText('8,000원').length).toBeGreaterThan(0)
  })

  it('changes order status from pending to preparing', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '관리자' }))
    const startButtons = await screen.findAllByRole('button', { name: '제조시작' })
    fireEvent.click(startButtons[0])

    await waitFor(() => {
      expect(screen.getByText('주문 상태가 변경되었습니다.')).toBeInTheDocument()
    })
  })
})
