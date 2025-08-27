/* Simple Express API for image generation and judging.
   Set OPENAI_API_KEY to enable real calls. Set MOCK_OPENAI=1 for local mocks. */
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const MOCK = process.env.MOCK_OPENAI === '1' || !process.env.OPENAI_API_KEY;

// Lazy import OpenAI SDK only if needed
let OpenAI;
if (!MOCK) {
  try {
    OpenAI = require('openai');
  } catch (e) {
    console.warn('OpenAI SDK not available, falling back to mock.');
  }
}

// Helpers
function ok(res, data) {
  res.json({ ok: true, data });
}
function err(res, message, status = 500) {
  res.status(status).json({ ok: false, error: message });
}

// POST /api/generate-image { description }
app.post('/api/generate-image', async (req, res) => {
  const { description } = req.body || {};
  if (!description || typeof description !== 'string') {
    return err(res, 'Missing description', 400);
  }
  try {
    if (MOCK || !OpenAI) {
      // Return a placeholder image with the description embedded as text
      const url = `https://dummyimage.com/512x512/233143/ffffff.png&text=${encodeURIComponent(description.slice(0, 40))}`;
      return ok(res, { imageUrl: url, model: 'mock' });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Use images generation API (model name subject to change)
    const resp = await client.images.generate({
      model: 'gpt-image-1',
      prompt: description,
      size: '512x512'
    });
    const imageUrl = resp.data?.[0]?.url;
    if (!imageUrl) return err(res, 'No image URL from model');
    return ok(res, { imageUrl, model: 'gpt-image-1' });
  } catch (e) {
    console.error(e);
    return err(res, 'Image generation failed');
  }
});

// POST /api/judge { originalDescription, guess }
app.post('/api/judge', async (req, res) => {
  const { originalDescription, guess } = req.body || {};
  if (!originalDescription || !guess) return err(res, 'Missing fields', 400);
  try {
    if (MOCK || !OpenAI) {
      // Simple heuristic: case-insensitive keyword overlap > 2 words
      const a = new Set(String(originalDescription).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const b = new Set(String(guess).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      let overlap = 0;
      for (const w of b) if (a.has(w)) overlap++;
      const correct = overlap >= 3 || guess.trim().toLowerCase() === originalDescription.trim().toLowerCase();
      return ok(res, { correct, rationale: `overlap_words=${overlap}` });
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sys = 'You are a strict judge for a guessing game. Given the original prompt that generated an image and a player guess describing that image, reply with a JSON object {"correct": boolean, "rationale": string}. The guess must capture the main subject and key attributes to be correct.';
    const user = `Original: ${originalDescription}\nGuess: ${guess}\nReturn only JSON.`;
    const chat = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    });
    const content = chat.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(content); } catch {}
    const correct = !!parsed.correct;
    const rationale = parsed.rationale || 'model';
    return ok(res, { correct, rationale });
  } catch (e) {
    console.error(e);
    return err(res, 'Judge failed');
  }
});

app.get('/api/health', (_req, res) => ok(res, { status: 'ok', mock: MOCK }));

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT} (mock=${MOCK})`);
});
