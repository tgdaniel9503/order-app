import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { getStockStatus } from './utils/stockStatus'

describe('order app behavior', () => {
  it('returns expected stock status by quantity', () => {
    expect(getStockStatus(10)).toBe('정상')
    expect(getStockStatus(3)).toBe('주의')
    expect(getStockStatus(0)).toBe('품절')
  })

  it('merges same cart item and increments quantity', () => {
    render(<App />)

    const addButtons = screen.getAllByRole('button', { name: '담기' })
    fireEvent.click(addButtons[0])
    fireEvent.click(addButtons[0])

    expect(screen.getByText('x 2')).toBeInTheDocument()
    expect(screen.getAllByText('8,000원').length).toBeGreaterThan(0)
  })

  it('changes order status from pending to preparing', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '관리자' }))
    fireEvent.click(screen.getAllByRole('button', { name: '제조시작' })[0])

    await waitFor(() => {
      expect(screen.getByText('9개')).toBeInTheDocument()
    })
  })
})
