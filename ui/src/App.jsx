import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

import {
  advanceOrderStatus as advanceOrderStatusApi,
  createOrder as createOrderApi,
  getAdminMenus,
  getMenus,
  getOrders,
  updateMenuStock,
} from './api'
import { getStockStatus } from './utils/stockStatus'

const formatPrice = (value) => `${value.toLocaleString('ko-KR')}원`
const formatDateTime = (value) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
const ORDER_STATUS_LABEL = {
  pending: '주문 접수',
  preparing: '제조 중',
  done: '제조 완료',
}

function App() {
  const [currentView, setCurrentView] = useState('order')
  const [menus, setMenus] = useState([])
  const [adminMenus, setAdminMenus] = useState([])
  const [selectedOptions, setSelectedOptions] = useState({})
  const [cartItems, setCartItems] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingMenus, setIsLoadingMenus] = useState(true)
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true)
  const [updatingInventory, setUpdatingInventory] = useState({})
  const [updatingOrder, setUpdatingOrder] = useState({})
  const [orders, setOrders] = useState([])
  const [notice, setNotice] = useState({ type: '', message: '' })

  const loadMenus = useCallback(async () => {
    setIsLoadingMenus(true)
    try {
      setMenus(await getMenus())
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setIsLoadingMenus(false)
    }
  }, [])

  const loadAdminData = useCallback(async () => {
    setIsLoadingAdmin(true)
    try {
      const [adminMenuData, orderData] = await Promise.all([getAdminMenus(), getOrders()])
      setAdminMenus(adminMenuData)
      setOrders(orderData)
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setIsLoadingAdmin(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMenus()
      loadAdminData()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadMenus, loadAdminData])

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

  const toggleOption = (menuId, optionId) => {
    setSelectedOptions((prev) => {
      const current = prev[menuId] ?? {}
      return {
        ...prev,
        [menuId]: {
          ...current,
          [optionId]: !current[optionId],
        },
      }
    })
  }

  const addToCart = (menu) => {
    const optionMap = selectedOptions[menu.id] ?? {}
    const selectedOptionList = menu.options.filter((option) => optionMap[option.id])
    const optionPrice = selectedOptionList.reduce((sum, option) => sum + option.price, 0)
    const itemPrice = menu.price + optionPrice
    const optionIds = selectedOptionList.map((option) => option.id)
    const optionSummary = selectedOptionList.map((option) => option.name)
    const itemKey = `${menu.id}-${optionIds.join('-')}`

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
          optionIds,
          optionSummary,
          quantity: 1,
          unitPrice: itemPrice,
          lineTotal: itemPrice,
        },
      ]
    })

    setNotice({ type: 'success', message: `${menu.name}이(가) 장바구니에 담겼습니다.` })
  }

  const updateCartItemQuantity = (itemKey, delta) => {
    setCartItems((prev) =>
      prev.flatMap((item) => {
        if (item.itemKey !== itemKey) return [item]

        const nextQuantity = item.quantity + delta
        if (nextQuantity <= 0) return []

        return [
          {
            ...item,
            quantity: nextQuantity,
            lineTotal: nextQuantity * item.unitPrice,
          },
        ]
      }),
    )
  }

  const createOrder = async () => {
    if (!cartItems.length || isSubmitting) return

    setIsSubmitting(true)
    setNotice({ type: '', message: '' })

    try {
      await createOrderApi(
        cartItems.map((item) => ({
          menuId: item.menuId,
          quantity: item.quantity,
          optionIds: item.optionIds,
        })),
      )
      setCartItems([])
      await Promise.all([loadMenus(), loadAdminData()])
      setNotice({ type: 'success', message: '주문이 완료되었습니다.' })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || '주문 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateInventory = async (menuId, delta) => {
    if (updatingInventory[menuId]) return
    const currentValue = adminMenus.find((menu) => menu.id === menuId)?.stockQuantity ?? 0
    if (delta < 0 && currentValue <= 0) {
      setNotice({ type: 'error', message: '재고는 0 미만으로 줄일 수 없습니다.' })
      return
    }

    setUpdatingInventory((prev) => ({ ...prev, [menuId]: true }))
    setNotice({ type: '', message: '' })

    try {
      const updatedMenu = await updateMenuStock({ menuId, delta })
      setAdminMenus((prev) =>
        prev.map((menu) => (menu.id === updatedMenu.id ? { ...menu, ...updatedMenu } : menu)),
      )
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || '재고 업데이트 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setUpdatingInventory((prev) => ({ ...prev, [menuId]: false }))
    }
  }

  const advanceOrderStatus = async (orderId) => {
    if (updatingOrder[orderId]) return

    setUpdatingOrder((prev) => ({ ...prev, [orderId]: true }))
    setNotice({ type: '', message: '' })

    try {
      const updatedOrder = await advanceOrderStatusApi(orderId)
      setOrders((prev) => prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)))
      setNotice({ type: 'success', message: '주문 상태가 변경되었습니다.' })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || '주문 상태 변경 중 오류가 발생했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setUpdatingOrder((prev) => ({ ...prev, [orderId]: false }))
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
              {isLoadingMenus ? <p className="empty">메뉴를 불러오는 중입니다...</p> : null}
              {!isLoadingMenus && menus.length === 0 ? (
                <p className="empty">표시할 메뉴가 없습니다.</p>
              ) : null}
              {menus.map((menu) => {
                const checked = selectedOptions[menu.id] ?? {}
                return (
                  <article className="menu-card" key={menu.id}>
                    <img className="thumb" src={menu.imageUrl} alt={menu.name} />
                    <h2>{menu.name}</h2>
                    <p className="price">{formatPrice(menu.price)}</p>
                    <p className="description">{menu.description}</p>

                    {menu.options.map((option) => (
                      <label className="option" key={option.id}>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[option.id])}
                          onChange={() => toggleOption(menu.id, option.id)}
                        />
                        <span>
                          {option.name} (+{option.price.toLocaleString('ko-KR')}원)
                        </span>
                      </label>
                    ))}

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
                          <p className="item-line-price">{formatPrice(item.lineTotal)}</p>
                          <div className="quantity-control" aria-label={`${item.name} 수량 조절`}>
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => updateCartItemQuantity(item.itemKey, -1)}
                              aria-label={`${item.name} 수량 감소`}
                            >
                              -
                            </button>
                            <span className="quantity-value">{item.quantity}</span>
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => updateCartItemQuantity(item.itemKey, 1)}
                              aria-label={`${item.name} 수량 증가`}
                            >
                              +
                            </button>
                          </div>
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
                {isLoadingAdmin ? <p className="empty">재고를 불러오는 중입니다...</p> : null}
                {adminMenus.map((menu) => {
                  const stockQuantity = menu.stockQuantity ?? menu.stock_quantity ?? 0
                  const stockStatus = menu.stockStatus || getStockStatus(stockQuantity)

                  return (
                    <article key={menu.id} className="inventory-card">
                      <p className="inventory-name">{menu.name}</p>
                      <div className="inventory-stock-row">
                        <span className="inventory-qty">{stockQuantity}개</span>
                        <span className={`stock-badge ${stockStatus}`}>{stockStatus}</span>
                      </div>
                      <div className="inventory-actions">
                        <button
                          type="button"
                          className="small-btn"
                          disabled={Boolean(updatingInventory[menu.id])}
                          onClick={() => updateInventory(menu.id, 1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="small-btn"
                          disabled={Boolean(updatingInventory[menu.id])}
                          onClick={() => updateInventory(menu.id, -1)}
                        >
                          -
                        </button>
                      </div>
                    </article>
                  )
                })}
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
                    <p>{formatDateTime(order.orderedAt)}</p>
                    <p>{order.summary}</p>
                    <p>{formatPrice(order.totalAmount)}</p>
                    <span className={`status-chip ${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>
                    <button
                      type="button"
                      className="small-btn wide order-action-btn"
                      disabled={Boolean(updatingOrder[order.id]) || order.status === 'done'}
                      onClick={() => advanceOrderStatus(order.id)}
                    >
                      {updatingOrder[order.id]
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
