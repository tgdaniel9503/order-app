export const getStockStatus = (count) => {
  if (count === 0) return '품절'
  if (count < 5) return '주의'
  return '정상'
}
