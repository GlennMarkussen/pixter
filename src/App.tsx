import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import type { Player } from './types'

function normalizeText(s: string) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

function formatRoundPoints(
  rp: Record<number, number> | null,
  name1: string,
  name2: string
) {
  if (!rp) return ''
  const p1 = rp[1] ?? 0
  const p2 = rp[2] ?? 0
  const s = (v: number) => (v >= 0 ? `+${v}` : `${v}`)
  // Only guesser scores; show whoever got points.
  if (p1 !== 0 && p2 === 0) return `This round: ${name1} ${s(p1)}`
  if (p2 !== 0 && p1 === 0) return `This round: ${name2} ${s(p2)}`
  if (p1 === 0 && p2 === 0) return 'This round: no points'
  return `This round: ${name1} ${s(p1)}, ${name2} ${s(p2)}`
}

const PLAYERS: Player[] = [
  { id: 1, name: 'Jonas the Red', color: '#d94a4a' },
  { id: 2, name: 'Erna the Blue', color: '#4a72d9' },
]

type RoundData = {
  describerId: number
  description: string
  imageUrl?: string
  guess?: string
  correct?: boolean
  rationale?: string
  attempts?: Array<{ guess: string; correct: boolean; rationale?: string; closeness?: number }>
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>(PLAYERS)
  const [scores, setScores] = useState<Record<number, number>>({ 1: 0, 2: 0 })
  const [current, setCurrent] = useState<RoundData>(() => {
    const start = Math.random() < 0.5 ? 1 : 2
    return { describerId: start, description: '' }
  })
  const [started, setStarted] = useState<boolean>(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [roundOver, setRoundOver] = useState<boolean>(false)
  const [roundReason, setRoundReason] = useState<'max_attempts' | 'give_up' | null>(null)
  const [roundPoints, setRoundPoints] = useState<Record<number, number> | null>(null)

  // Theme: light/dark with persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('pixter.theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {}
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('pixter.theme', theme) } catch {}
  }, [theme])

  // Traditional scoring: only guesser scores. +1 per correct guess. First to targetScore wins.
  const [targetScore, setTargetScore] = useState<number>(() => {
    const v = Number(localStorage.getItem('pixter.targetScore'))
    return Number.isFinite(v) && v >= 1 ? v : 10
  })
  const [name1, setName1] = useState<string>(() => localStorage.getItem('pixter.name1') || PLAYERS[0].name)
  const [name2, setName2] = useState<string>(() => localStorage.getItem('pixter.name2') || PLAYERS[1].name)
  const POINTS_PER_CORRECT = 1

  const describer = useMemo(
    () => players.find(p => p.id === current.describerId)!,
    [current.describerId, players]
  )
  const guesser = useMemo(
    () => players.find(p => p.id !== current.describerId)!,
    [current.describerId, players]
  )

  const canWin = (s: Record<number, number>) => s[1] >= targetScore || s[2] >= targetScore

  // Persist targetScore and evaluate win condition when it changes
  useEffect(() => {
    try {
      localStorage.setItem('pixter.targetScore', String(targetScore))
    } catch {}
    if (!gameOver) {
      if (scores[1] >= targetScore || scores[2] >= targetScore) {
        setGameOver(true)
      }
    }
  }, [targetScore, gameOver, scores])

  async function handleDescribe(description: string) {
  if (loading) return
    setError(null)
    setLoading('Generating image...')
    try {
      const { imageUrl } = await api.generateImage(description)
      setCurrent((c: RoundData) => ({ ...c, description, imageUrl }))
    } catch (e: any) {
      setError(e.message || 'Failed to generate image')
    } finally {
      setLoading(null)
    }
  }

  async function handleGuess(guess: string) {
    if (!current.imageUrl) return
  if (loading) return
    // Avoid duplicate guess (same as last attempt in this round)
    const lastGuess = current.attempts?.[current.attempts.length - 1]?.guess
    if (lastGuess && normalizeText(lastGuess) === normalizeText(guess)) {
      return // silently ignore duplicate
    }
    setError(null)
    setLoading('Judging guess...')
    try {
      const { correct, rationale, closeness } = await api.judge(current.description, guess)
      let newAttemptsCount = (current.attempts?.length || 0) + 1
      setCurrent((c: RoundData) => {
        const attempts = [...(c.attempts || []), { guess, correct, rationale, closeness }]
        newAttemptsCount = attempts.length
        return { ...c, guess, correct, rationale, attempts }
      })
      if (correct) {
        // Award point to guesser only
        setScores((s: Record<number, number>) => {
          const next: Record<number, number> = {
            ...s,
            [guesser.id]: s[guesser.id] + POINTS_PER_CORRECT,
          }
          if (canWin(next)) setGameOver(true)
          return next
        })
        setRoundPoints({ [guesser.id]: POINTS_PER_CORRECT })
        // end round on correct
        setRoundOver(true)
        setRoundReason('correct' as any)
        return
      }
      // No score change for wrong guess; continue round up to 3 attempts
      // continue same round up to 3 attempts; if exceeded, end round and reveal answer
      if (newAttemptsCount >= 3) {
        setRoundOver(true)
        setRoundReason('max_attempts')
        setRoundPoints(null)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to judge')
    } finally {
      setLoading(null)
    }
  }

  function handleGiveUp() {
    if (!current.imageUrl) return
    if (loading) return
    const ok = window.confirm(
      'Are you sure you want to give up? The round will end with no points.'
    )
    if (!ok) return
    // no penalties; just end round
    setRoundPoints(null)
    // end round; reveal answer
    setRoundOver(true)
    setRoundReason('give_up')
    setError(null)
  }

  function nextRound() {
    // flip turn and reset round state
    setCurrent({ describerId: guesser.id, description: '' })
    setRoundOver(false)
    setRoundReason(null)
  setRoundPoints(null)
  }

  function startGame() {
    // Persist names and set players
    try {
      localStorage.setItem('pixter.name1', name1)
      localStorage.setItem('pixter.name2', name2)
    } catch {}
    setPlayers([
      { id: 1, name: name1.trim() || PLAYERS[0].name, color: PLAYERS[0].color },
      { id: 2, name: name2.trim() || PLAYERS[1].name, color: PLAYERS[1].color },
    ])
    setScores({ 1: 0, 2: 0 })
    const start = Math.random() < 0.5 ? 1 : 2
    setCurrent({ describerId: start, description: '' })
    setRoundOver(false)
    setRoundReason(null)
    setRoundPoints(null)
    setGameOver(false)
    setError(null)
    setStarted(true)
  }

  function resetGame() {
    setScores({ 1: 0, 2: 0 })
    const start = Math.random() < 0.5 ? 1 : 2
    setCurrent({ describerId: start, description: '' })
    setGameOver(false)
    setError(null)
    setStarted(false)
  }

  return (
    <div className="container">
      <header>
        <div>
          <h1>Pixter</h1>
          <span className="subtitle">A two-player picture guessing game</span>
        </div>
        <button
          className="icon-button"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '🌞 Light' : '🌙 Dark'}
        </button>
      </header>

      {!started ? (
        <StartScreen
          targetScore={targetScore}
          setTargetScore={setTargetScore}
          onStart={startGame}
          name1={name1}
          name2={name2}
          setName1={setName1}
          setName2={setName2}
        />
      ) : gameOver ? (
        <GameOver scores={scores} players={players} onReset={resetGame} />
      ) : (
        <>
          <Scoreboard scores={scores} players={players} />
          <TurnBanner describer={describer.name} guesser={guesser.name} />
          {!current.imageUrl ? (
            <DescribeForm
              onSubmit={handleDescribe}
              player={describer}
              busy={!!loading && loading.startsWith('Generating')}
            />
          ) : roundOver ? (
            <RoundSummary
              correctAnswer={current.description}
              imageUrl={current.imageUrl}
              reason={roundReason || 'max_attempts'}
              pointsLabel={formatRoundPoints(
                roundPoints,
                players.find(p => p.id === 1)?.name || 'Player 1',
                players.find(p => p.id === 2)?.name || 'Player 2'
              )}
              onNextRound={nextRound}
            />
          ) : (
            <GuessForm
              onSubmit={handleGuess}
              player={guesser}
              imageUrl={current.imageUrl}
              attempts={current.attempts || []}
              busy={!!loading && loading.startsWith('Judging')}
              onGiveUp={handleGiveUp}
            />
          )}

          {/* Rationale intentionally hidden to avoid spoilers */}
        </>
      )}

      {loading && !loading.startsWith('Generating') && (
        <div className="loading">{loading}</div>
      )}
      {error && <div className="error">{error}</div>}

      <footer>
        <small>
          Backend health: <HealthBadge />
        </small>
      </footer>
    </div>
  )
}

function Scoreboard({ scores, players }: { scores: Record<number, number>; players: Player[] }) {
  const p1 = players.find(p => p.id === 1)!
  const p2 = players.find(p => p.id === 2)!
  return (
    <div className="scoreboard">
      <Score name={p1.name} color={p1.color} value={scores[1]} />
      <Score name={p2.name} color={p2.color} value={scores[2]} />
    </div>
  )
}

function Score({ name, color, value }: { name: string; color: string; value: number }) {
  return (
    <div className="score" style={{ borderColor: color }}>
      <div className="name" style={{ color }}>
        {name}
      </div>
      <div className="value">{value}</div>
    </div>
  )
}

function TurnBanner({ describer, guesser }: { describer: string; guesser: string }) {
  return (
    <div className="turn">
      <strong>{describer}</strong> describes. <strong>{guesser}</strong> guesses.
    </div>
  )
}

function DescribeForm({
  onSubmit,
  player,
  busy,
}: {
  onSubmit: (d: string) => void
  player: Player
  busy?: boolean
}) {
  const [text, setText] = useState('')
  return (
    <div className="card">
      <h3 style={{ color: player.color }}>{player.name}, describe the scene</h3>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
        placeholder="Describe a scene..."
      />
      {busy ? (
        <span className="subtitle">Generating image…</span>
      ) : (
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
          Generate Image
        </button>
      )}
    </div>
  )
}

function GuessForm({
  onSubmit,
  player,
  imageUrl,
  attempts,
  busy,
  onGiveUp,
}: {
  onSubmit: (g: string) => void
  player: Player
  imageUrl: string
  attempts: Array<{ guess: string; correct: boolean; rationale?: string; closeness?: number }>
  busy?: boolean
  onGiveUp?: () => void
}) {
  const [guess, setGuess] = useState('')
  const last = attempts?.[attempts.length - 1]?.guess
  const isDuplicate = last && normalizeText(last) === normalizeText(guess)
  const canSubmit = !busy && !!guess.trim() && !isDuplicate
  return (
    <div className="card">
      <h3 style={{ color: player.color }}>{player.name}, describe what you see</h3>
      <img className="preview" src={imageUrl} alt="generated" />
      <textarea
        value={guess}
        onChange={e => setGuess(e.target.value)}
        rows={4}
        placeholder="Your description..."
        disabled={!!busy}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button disabled={!canSubmit} onClick={() => onSubmit(guess.trim())}>
          Submit Guess
        </button>
        {onGiveUp && (
          <button disabled={!!busy} onClick={() => onGiveUp()} style={{ background: '#374151', color: '#e5e7eb' }}>
            Give up
          </button>
        )}
        <span className="subtitle">
          Attempt {Math.min((attempts?.length || 0) + 1, 3)} of 3{busy ? ' • Judging…' : ''}
          {isDuplicate ? ' • same as previous' : ''}
        </span>
      </div>
      {attempts?.length ? (
        <div style={{ marginTop: 10 }}>
          <div className="subtitle">Previous attempts</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {attempts
              .filter((a, idx, arr) => {
                // show each unique guess once (normalized)
                const n = normalizeText(a.guess)
                return arr.findIndex(x => normalizeText(x.guess) === n) === idx
              })
              .map((a, idx) => (
              <li key={idx}>
                <span>{a.guess}</span>
                {typeof a.closeness === 'number' && (
                  <span style={{ marginLeft: 8, color: '#93c5fd' }}>
                    closeness: {(a.closeness * 100).toFixed(0)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function GameOver({
  scores,
  players,
  onReset,
}: {
  scores: Record<number, number>
  players: Player[]
  onReset: () => void
}) {
  // Determine winner as higher score (positive target-based)
  const p1 = players.find(p => p.id === 1)!
  const p2 = players.find(p => p.id === 2)!
  const winnerName = scores[1] >= scores[2] ? p1.name : p2.name
  return (
    <div className="card" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🏆</div>
      <h2 style={{ marginTop: 0 }}>Winner</h2>
      <p style={{ fontSize: 20, margin: '8px 0 16px' }}>
        <strong>{winnerName}</strong>
      </p>
      <p className="subtitle" style={{ marginBottom: 20 }}>Reached the target score!</p>
      <button onClick={onReset}>Play Again</button>
    </div>
  )
}

import { useState as useState2 } from 'react'
function HealthBadge() {
  const [status, setStatus] = useState2<'ok' | 'down' | 'loading'>('loading')
  const [mock, setMock] = useState2<boolean>(false)
  useEffect(() => {
    let mounted = true
    api
      .health()
      .then(j => {
        if (!mounted) return
        setStatus(j.ok ? 'ok' : 'down')
        setMock(!!j.data?.mock)
      })
      .catch(() => mounted && setStatus('down'))
    return () => {
      mounted = false
    }
  }, [])
  if (status === 'loading') return <span className="badge">checking...</span>
  return (
    <span className={`badge ${status}`}>
      {status}
      {mock ? ' (mock)' : ''}
    </span>
  )
}

function RoundSummary({
  correctAnswer,
  imageUrl,
  reason,
  pointsLabel,
  onNextRound,
}: {
  correctAnswer: string
  imageUrl?: string
  reason: 'max_attempts' | 'give_up' | 'correct'
  pointsLabel?: string
  onNextRound: () => void
}) {
  return (
    <div className="card">
      <h3>Round over</h3>
      {imageUrl && <img className="preview" src={imageUrl} alt="round" />}
      <p className="subtitle">
        {reason === 'give_up'
          ? 'Player gave up.'
          : reason === 'max_attempts'
          ? 'No more attempts left.'
          : 'Correct guess!'}
      </p>
      <p>
        Correct answer: <strong>{correctAnswer}</strong>
      </p>
      {pointsLabel ? <p className="subtitle">{pointsLabel}</p> : null}
      <button onClick={onNextRound}>Next round</button>
    </div>
  )
}

function StartScreen({
  targetScore,
  setTargetScore,
  onStart,
  name1,
  name2,
  setName1,
  setName2,
}: {
  targetScore: number
  setTargetScore: (n: number) => void
  onStart: () => void
  name1: string
  name2: string
  setName1: (s: string) => void
  setName2: (s: string) => void
}) {
  const clamped = (v: number) => Math.max(1, Math.min(100, Math.floor(v || 0)))
  return (
    <div className="start">
      <div className="start__hero">🌟 The MOST EPIC, MIND-BLOWING, JAW-DROPPING GUESSING GAME EVER™ 🌟</div>
      <div className="start__tagline">Summon fantastical images. Outsmart your rival. Claim eternal glory.</div>
      <div className="start__panel">
        <label className="settings__label" htmlFor="p1">Player 1</label>
        <input
          id="p1"
          className="settings__input start__input"
          type="text"
          maxLength={24}
          value={name1}
          onChange={e => setName1(e.target.value)}
        />
        <label className="settings__label" htmlFor="p2">Player 2</label>
        <input
          id="p2"
          className="settings__input start__input"
          type="text"
          maxLength={24}
          value={name2}
          onChange={e => setName2(e.target.value)}
        />
        <label className="settings__label" htmlFor="targetScore">Target score</label>
        <input
          id="targetScore"
          className="settings__input start__input"
          type="number"
          min={1}
          max={100}
          value={targetScore}
          onChange={e => setTargetScore(clamped(Number(e.target.value)))}
        />
        <button onClick={onStart}>Start Game</button>
      </div>
    </div>
  )
}
