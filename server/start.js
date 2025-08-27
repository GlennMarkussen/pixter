const fs = require('fs')
const path = require('path')

// Resolve secret key file at project root
const secretPath = path.resolve(__dirname, '..', 'secretkey.txt')

try {
  if (fs.existsSync(secretPath)) {
    const key = fs.readFileSync(secretPath, 'utf8').trim()
    if (key) {
      process.env.OPENAI_API_KEY = key
      // If key exists, ensure mock is disabled unless explicitly enabled elsewhere
      if (!process.env.MOCK_OPENAI) process.env.MOCK_OPENAI = '0'
      console.log('[bootstrap] OPENAI_API_KEY loaded from secretkey.txt')
    } else {
      console.warn('[bootstrap] secretkey.txt is empty; API will run in mock mode')
    }
  } else {
    console.warn('[bootstrap] secretkey.txt not found; API will run in mock mode')
  }
} catch (e) {
  console.warn('[bootstrap] Failed to read secretkey.txt; API will run in mock mode')
}

require('./index')
