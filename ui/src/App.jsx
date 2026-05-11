import { useMemo, useState } from 'react'
import './App.css'

const MENU_ITEMS = [
  {
    id: 'americano-ice',
    name: '아메리카노(ICE)',
    price: 4000,
    description: '시원하고 깔끔한 풍미의 아이스 아메리카노',
    imageUrl:
      'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'americano-hot',
    name: '아메리카노(HOT)',
    price: 4000,
    description: '진한 향과 밸런스를 가진 따뜻한 아메리카노',
    imageUrl:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'cafe-latte',
    name: '카페라떼',
    price: 5000,
    description: '부드러운 우유와 에스프레소가 어우러진 라떼',
    imageUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
  },
]

const OPTIONS = {
  shot: { label: '샷 추가', price: 500 },
  syrup: { label: '시럽 추가', price: 0 },
}

const formatPrice = (value) => `${value.toLocaleString('ko-KR')}원`
const ORDER_STATUS_LABEL = {
  pending: '주문 접수',
  preparing: '제조 중',
  done: '제조 완료',
}
const getStockStatus = (count) => {
  if (count === 0) return '품절'
  if (count < 5) return '주의'
  return '정상'
}

function App() {
  const [currentView, setCurrentView] = useState('order')
  const [selectedOptions, setSelectedOptions] = useState({})
  const [cartItems, setCartItems] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingInventoryId, setUpdatingInventoryId] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [inventory, setInventory] = useState({
    'americano-ice': 10,
    'americano-hot': 10,
    'cafe-latte': 10,
  })
  const [orders, setOrders] = useState([
    {
      id: 'ord-001',
      orderedAt: '7월 31일 13:00',
      summary: '아메리카노(ICE) x 1',
      total: 4000,
      status: 'pending',
      items: [{ menuId: 'americano-ice', quantity: 1 }],
    },
    {
      id: 'ord-002',
      orderedAt: '7월 31일 13:12',
      summary: '카페라떼 x 2',
      total: 10000,
      status: 'preparing',
      items: [{ menuId: 'cafe-latte', quantity: 2 }],
    },
    {
      id: 'ord-003',
      orderedAt: '7월 31일 13:18',
      summary: '아메리카노(HOT) x 1',
      total: 4000,
      status: 'done',
      items: [{ menuId: 'americano-hot', quantity: 1 }],
    },
  ])
  const [notice, setNotice] = useState({ type: '', message: '' })

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems],
  )
  const dashboardCounts = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((order) => order.status === 'pending').length,
      preparing: orders.filter((order) => order.status === 'preparing').length,
      done: orders.filter((order) => order.status === 'done').length,
    }),
    [orders],
  )

  const toggleOption = (menuId, optionKey) => {
    setSelectedOptions((prev) => {
      const current = prev[menuId] ?? { shot: false, syrup: false }
      return {
        ...prev,
        [menuId]: {
          ...current,
          [optionKey]: !current[optionKey],
        },
      }
    })
  }

  const addToCart = (menu) => {
    const options = selectedOptions[menu.id] ?? { shot: false, syrup: false }
    const optionPrice =
      (options.shot ? OPTIONS.shot.price : 0) +
      (options.syrup ? OPTIONS.syrup.price : 0)
    const itemPrice = menu.price + optionPrice
    const optionSummary = ['shot', 'syrup']
      .filter((key) => options[key])
      .map((key) => OPTIONS[key].label)
    const itemKey = `${menu.id}-${options.shot}-${options.syrup}`

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.itemKey === itemKey)
      if (existingIndex > -1) {
        return prev.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: item.quantity + 1,
                lineTotal: (item.quantity + 1) * itemPrice,
              }
            : item,
        )
      }

      return [
        ...prev,
        {
          itemKey,
          menuId: menu.id,
          name: menu.name,
          basePrice: menu.price,
          options,
          optionSummary,
          quantity: 1,
          unitPrice: itemPrice,
          lineTotal: itemPrice,
        },
      ]
    })

    setNotice({ type: 'success', message: `${menu.name}이(가) 장바구니에 담겼습니다.` })
  }

  const createOrder = async () => {
    if (!cartItems.length || isSubmitting) return

    setIsSubmitting(true)
    setNotice({ type: '', message: '' })

    try {
      // 백엔드 연결 전까지는 주문 성공 흐름을 모의 처리한다.
      await new Promise((resolve) => setTimeout(resolve, 800))
      setCartItems([])
      setNotice({ type: 'success', message: '주문이 완료되었습니다.' })
    } catch {
      setNotice({
        type: 'error',
        message: '주문 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateInventory = async (menuId, delta) => {
    if (updatingInventoryId) return
    const currentValue = inventory[menuId] ?? 0
    if (delta < 0 && currentValue <= 0) {
      setNotice({ type: 'error', message: '재고는 0 미만으로 줄일 수 없습니다.' })
      return
    }

    setUpdatingInventoryId(menuId)
    setNotice({ type: '', message: '' })

    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      setInventory((prev) => ({
        ...prev,
        [menuId]: Math.max((prev[menuId] ?? 0) + delta, 0),
      }))
    } catch {
      setNotice({
        type: 'error',
        message: '재고 업데이트 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setUpdatingInventoryId('')
    }
  }

  const advanceOrderStatus = async (orderId) => {
    if (updatingOrderId) return
    const targetOrder = orders.find((order) => order.id === orderId)
    if (!targetOrder) return

    setUpdatingOrderId(orderId)
    setNotice({ type: '', message: '' })

    try {
      await new Promise((resolve) => setTimeout(resolve, 400))

      if (targetOrder.status === 'pending') {
        const hasEnoughStock = targetOrder.items.every((item) => {
          const stock = inventory[item.menuId] ?? 0
          return stock >= item.quantity
        })

        if (!hasEnoughStock) {
          setNotice({ type: 'error', message: '재고가 부족하여 주문을 접수할 수 없습니다.' })
          return
        }

        setInventory((prev) => {
          const next = { ...prev }
          targetOrder.items.forEach((item) => {
            next[item.menuId] = Math.max((next[item.menuId] ?? 0) - item.quantity, 0)
          })
          return next
        })
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: 'preparing' } : order,
          ),
        )
        setNotice({ type: 'success', message: '주문이 접수되어 제조 중 상태로 변경되었습니다.' })
        return
      }

      if (targetOrder.status === 'preparing') {
        setOrders((prev) =>
          prev.map((order) => (order.id === orderId ? { ...order, status: 'done' } : order)),
        )
        setNotice({ type: 'success', message: '주문이 제조 완료 처리되었습니다.' })
      }
    } catch {
      setNotice({
        type: 'error',
        message: '주문 상태 변경 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setUpdatingOrderId('')
    }
  }

  return (
    <div className="app">
      <header className="top-nav">
        <h1 className="brand">COZY</h1>
        <nav className="tabs" aria-label="주요 메뉴">
          <button
            type="button"
            className={`tab ${currentView === 'order' ? 'active' : ''}`}
            onClick={() => setCurrentView('order')}
          >
            주문하기
          </button>
          <button
            type="button"
            className={`tab ${currentView === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentView('admin')}
          >
            관리자
          </button>
        </nav>
      </header>

      {notice.message ? (
        <p className={`notice ${notice.type}`} role="status">
          {notice.message}
        </p>
      ) : null}

      <main>
        {currentView === 'order' ? (
          <>
            <section className="menu-grid">
              {MENU_ITEMS.map((menu) => {
                const checked = selectedOptions[menu.id] ?? { shot: false, syrup: false }
                return (
                  <article className="menu-card" key={menu.id}>
                    <img className="thumb" src={menu.imageUrl} alt={menu.name} />
                    <h2>{menu.name}</h2>
                    <p className="price">{formatPrice(menu.price)}</p>
                    <p className="description">{menu.description}</p>

                    <label className="option">
                      <input
                        type="checkbox"
                        checked={checked.shot}
                        onChange={() => toggleOption(menu.id, 'shot')}
                      />
                      <span>샷 추가 (+500원)</span>
                    </label>

                    <label className="option">
                      <input
                        type="checkbox"
                        checked={checked.syrup}
                        onChange={() => toggleOption(menu.id, 'syrup')}
                      />
                      <span>시럽 추가 (+0원)</span>
                    </label>

                    <button type="button" className="primary-btn" onClick={() => addToCart(menu)}>
                      담기
                    </button>
                  </article>
                )
              })}
            </section>

            <section className="cart-panel" aria-live="polite">
              <h3>장바구니</h3>
              <div className="cart-layout">
                <div className="cart-left">
                  {cartItems.length ? (
                    <ul className="cart-list">
                      {cartItems.map((item) => (
                        <li key={item.itemKey} className="cart-item">
                          <p className="item-name">
                            {item.name}
                            {item.optionSummary.length ? ` (${item.optionSummary.join(', ')})` : ''}
                          </p>
                          <p className="item-qty">x {item.quantity}</p>
                          <p className="item-line-price">{formatPrice(item.lineTotal)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty">장바구니가 비어 있습니다.</p>
                  )}
                </div>

                <div className="cart-right">
                  <p className="total-label">
                    총 금액 <strong>{formatPrice(totalAmount)}</strong>
                  </p>
                  <button
                    type="button"
                    className="primary-btn order-btn"
                    disabled={!cartItems.length || isSubmitting}
                    onClick={createOrder}
                  >
                    {isSubmitting ? '주문 처리 중...' : '주문하기'}
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="admin-page">
            <section className="admin-section">
              <h3>관리자 대시보드</h3>
              <div className="dashboard-grid">
                <div className="dashboard-item">
                  <p className="dashboard-label">총 주문</p>
                  <p className="dashboard-value">{dashboardCounts.total}건</p>
                </div>
                <div className="dashboard-item">
                  <p className="dashboard-label">주문 접수</p>
                  <p className="dashboard-value">{dashboardCounts.pending}건</p>
                </div>
                <div className="dashboard-item">
                  <p className="dashboard-label">제조 중</p>
                  <p className="dashboard-value">{dashboardCounts.preparing}건</p>
                </div>
                <div className="dashboard-item">
                  <p className="dashboard-label">제조 완료</p>
                  <p className="dashboard-value">{dashboardCounts.done}건</p>
                </div>
              </div>
            </section>

            <section className="admin-section">
              <h3>재고 현황</h3>
              <div className="inventory-grid">
                {MENU_ITEMS.map((menu) => (
                  <article key={menu.id} className="inventory-card">
                    <p className="inventory-name">{menu.name}</p>
                    <p className="inventory-qty">{inventory[menu.id] ?? 0}개</p>
                    <p className={`stock-badge ${getStockStatus(inventory[menu.id] ?? 0)}`}>
                      {getStockStatus(inventory[menu.id] ?? 0)}
                    </p>
                    <div className="inventory-actions">
                      <button
                        type="button"
                        className="small-btn"
                        disabled={updatingInventoryId === menu.id}
                        onClick={() => updateInventory(menu.id, 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="small-btn"
                        disabled={updatingInventoryId === menu.id}
                        onClick={() => updateInventory(menu.id, -1)}
                      >
                        -
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-section">
              <h3>주문 현황</h3>
              <div className="order-header">
                <p>접수 일시</p>
                <p>주문 메뉴</p>
                <p>금액</p>
                <p>상태</p>
                <p>작업</p>
              </div>
              <ul className="order-list">
                {orders.map((order) => (
                  <li key={order.id} className="order-row">
                    <p>{order.orderedAt}</p>
                    <p>{order.summary}</p>
                    <p>{formatPrice(order.total)}</p>
                    <span className={`status-chip ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                    <button
                      type="button"
                      className="small-btn wide"
                      disabled={updatingOrderId === order.id || order.status === 'done'}
                      onClick={() => advanceOrderStatus(order.id)}
                    >
                      {updatingOrderId === order.id
                        ? '처리 중...'
                        : order.status === 'pending'
                          ? '제조시작'
                          : order.status === 'preparing'
                            ? '제조완료'
                            : '완료'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
