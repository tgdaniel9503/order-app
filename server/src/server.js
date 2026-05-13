import 'dotenv/config'
import app from './app.js'

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`COZY order API server is running on http://localhost:${PORT}`)
})
