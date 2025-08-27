/* Simple Express API for image generation and judging.
   Set OPENAI_API_KEY to enable real calls. Set MOCK_OPENAI=1 for local mocks. */
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3001
const MOCK = process.env.MOCK_OPENAI === '1' || !process.env.OPENAI_API_KEY

// Lazy import OpenAI SDK only if needed
let OpenAI
if (!MOCK) {
  try {
    // ESM default export interop: handle require('openai') in CJS
    const mod = require('openai')
    OpenAI = mod?.OpenAI || mod?.default || mod
  } catch (e) {
    console.warn('OpenAI SDK not available, falling back to mock.', e?.message || e)
  }
}

// Preferred image models in order; allow override via env
const IMAGE_MODELS = Array.from(
  new Set([process.env.OPENAI_IMAGE_MODEL, 'gpt-image-1', 'dall-e-3'].filter(Boolean))
)

// Helpers
function ok(res, data) {
  res.json({ ok: true, data })
}
function err(res, message, status = 500) {
  res.status(status).json({ ok: false, error: message })
}

// POST /api/generate-image { description }
app.post('/api/generate-image', async (req, res) => {
  const { description } = req.body || {}
  if (!description || typeof description !== 'string') {
    return err(res, 'Missing description', 400)
  }
  try {
    if (MOCK || !OpenAI) {
      // Return a placeholder image with the description embedded as text
      const url = `https://dummyimage.com/1024x1024/233143/ffffff.png&text=${encodeURIComponent(description.slice(0, 40))}`
      return ok(res, { imageUrl: url, model: 'mock' })
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    // Use images generation API (model name subject to change)
    let lastErr
    for (const model of IMAGE_MODELS) {
      try {
        let resp
        try {
          resp = await client.images.generate({
            model,
            prompt: description,
            size: '1024x1024',
          })
        } catch (e) {
          // Fallback to auto if size not accepted
          resp = await client.images.generate({
            model,
            prompt: description,
            size: 'auto',
          })
        }
        const d0 = resp?.data?.[0] || {}
        const b64 = d0.b64_json
        const url = d0.url
        if (!b64 && !url) {
          lastErr = new Error('No image content from model')
          continue
        }
        const imageUrl = b64 ? `data:image/png;base64,${b64}` : url
        return ok(res, { imageUrl, model })
      } catch (e) {
        lastErr = e
        console.warn(
          `[generate-image] model ${model} failed:`,
          e?.status || '',
          e?.response?.data || e?.message || e
        )
        // Try next model
      }
    }
    // If loop completes without returning
    throw lastErr || new Error('All image models failed')
  } catch (e) {
    console.error(
      '[generate-image] OpenAI error:',
      e?.status || '',
      e?.response?.data || e?.message || e
    )
    // Fallback to placeholder when OpenAI fails (e.g., billing limit)
    const url = `https://dummyimage.com/1024x1024/233143/ffffff.png&text=${encodeURIComponent('mock: ' + description.slice(0, 40))}`
    return ok(res, { imageUrl: url, model: 'mock-fallback' })
  }
})

// POST /api/judge { originalDescription, guess }
app.post('/api/judge', async (req, res) => {
  const { originalDescription, guess } = req.body || {}
  if (!originalDescription || !guess) return err(res, 'Missing fields', 400)
  // Helper to compute a simple similarity (Jaccard index over words)
  function computeCloseness(aText, bText) {
    const a = new Set(
      String(aText)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    )
    const b = new Set(
      String(bText)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    )
    let inter = 0
    for (const w of b) if (a.has(w)) inter++
    const union = new Set([...a, ...b]).size || 1
    return { closeness: inter / union, overlap: inter }
  }
  try {
    if (MOCK || !OpenAI) {
      // Simple heuristic: case-insensitive keyword overlap > 2 words
      const { closeness, overlap } = computeCloseness(originalDescription, guess)
      const correct =
        overlap >= 3 || guess.trim().toLowerCase() === originalDescription.trim().toLowerCase()
      return ok(res, { correct, rationale: `overlap_words=${overlap}`, closeness })
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const sys =
      'You are a strict judge for a guessing game. Given the original prompt that generated an image and a player guess describing that image, reply with a JSON object {"correct": boolean, "rationale": string}. The guess must capture the main subject and key attributes to be correct.'
    const user = `Original: ${originalDescription}\nGuess: ${guess}\nReturn only JSON.`
    const chat = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    })
    const content = chat.choices?.[0]?.message?.content || '{}'
    let parsed = {}
    try {
      parsed = JSON.parse(content)
    } catch {}
    const correct = !!parsed.correct
    const rationale = parsed.rationale || 'model'
    const { closeness, overlap } = computeCloseness(originalDescription, guess)
    return ok(res, { correct, rationale, closeness })
  } catch (e) {
    console.error('[judge] OpenAI error:', e?.status || '', e?.response?.data || e?.message || e)
    // Heuristic fallback instead of hard error
    const { closeness, overlap } = computeCloseness(originalDescription, guess)
    const correct =
      overlap >= 3 || guess.trim().toLowerCase() === originalDescription.trim().toLowerCase()
    return ok(res, { correct, rationale: `fallback_overlap_words=${overlap}`, closeness })
  }
})

app.get('/api/health', (_req, res) => ok(res, { status: 'ok', mock: MOCK }))

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT} (mock=${MOCK})`)
})
