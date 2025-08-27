# Pixter

A two-player picture guessing game in the browser. Player A describes a scene; an image is generated. Player B describes what they see. Wrong guesses give -10 penalty. Game ends on a correct guess or -100.

- Frontend: React + Vite
- Backend: Express
- AI: OpenAI (mocked by default); enable with OPENAI_API_KEY

## Quick start

Prereqs: Node 18+.

```pwsh
# install deps
npm install

# run frontend + API (API uses mock by default)
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001 (health at /api/health)

To enable real OpenAI calls:

```pwsh
$env:OPENAI_API_KEY = "sk-..."
$env:MOCK_OPENAI = "0"  # optional; default mocks when no key is set
npm run api
```

## Notes

- Players: Jonas the Red and Erna the Blue; starting player is random each game.
- Penalty: -10 per wrong guess; game ends at -100 or when the guess is correct.
- Safe by default: API falls back to mock if no key present.

## Scripts

- dev: run Vite and API together with a proxy from /api to 3001
- frontend: run only Vite dev server
- api: run only the API server
- build: Vite production build
- preview: preview built frontend

## License

MIT
