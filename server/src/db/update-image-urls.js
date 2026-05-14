import 'dotenv/config'
import { pool, query } from './pool.js'

const updates = [
  ['아메리카노(ICE)', '/images/americano-ice.jpg'],
  ['아메리카노(HOT)', '/images/americano-hot.jpg'],
  ['카페라떼', '/images/caffe-latte.jpg'],
]

try {
  for (const [name, imageUrl] of updates) {
    await query('UPDATE menus SET image_url = $1, updated_at = NOW() WHERE name = $2', [
      imageUrl,
      name,
    ])
  }

  const result = await query('SELECT id, name, image_url FROM menus ORDER BY id')
  console.table(result.rows)
} finally {
  await pool.end()
}
