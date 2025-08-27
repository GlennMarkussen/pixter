import { useMemo, useState } from 'react'
import { api } from './api'
import type { Player } from './types'

const PLAYERS: Player[] = [
  { id: 1, name: 'Jonas the Red', color: '#d94a4a' },
  { id: 2, name: 'Erna the Blue', color: '#4a72d9' }
]

type RoundData = {
  describerId: number
  description: string
  imageUrl?: string
  guess?: string
  correct?: boolean
  rationale?: string
}

export default function App() {
  const [scores, setScores] = useState<Record<number, number>>({ 1: 0, 2: 0 })
  const [current, setCurrent] = useState<RoundData>(() => {
    const start = Math.random() < 0.5 ? 1 : 2
    return { describerId: start, description: '' }
  })
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState<boolean>(false)

  const describer = useMemo(() => PLAYERS.find(p => p.id === current.describerId)!, [current.describerId])
  const guesser = useMemo(() => PLAYERS.find(p => p.id !== current.describerId)!, [current.describerId])

  const canEnd = (s: Record<number, number>) => s[1] <= -100 || s[2] <= -100

  async function handleDescribe(description: string) {
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
    setError(null)
    setLoading('Judging guess...')
    try {
      const { correct, rationale } = await api.judge(current.description, guess)
  setCurrent((c: RoundData) => ({ ...c, guess, correct, rationale }))
      if (correct) {
        setGameOver(true)
        return
      }
      // penalty to guesser
      setScores((s: Record<number, number>) => {
        const next: Record<number, number> = { ...s, [guesser.id]: s[guesser.id] - 10 }
        if (canEnd(next)) setGameOver(true)
        return next
      })
      // flip turn
      setCurrent({ describerId: guesser.id, description: '' })
    } catch (e: any) {
      setError(e.message || 'Failed to judge')
    } finally {
      setLoading(null)
    }
  }

  function resetGame() {
    setScores({ 1: 0, 2: 0 })
    const start = Math.random() < 0.5 ? 1 : 2
    setCurrent({ describerId: start, description: '' })
    setGameOver(false)
    setError(null)
  }

  return (
    <div className="container">
      <header>
        <h1>Pixter</h1>
        <span className="subtitle">A two-player picture guessing game</span>
      </header>

      <Scoreboard scores={scores} />

      {gameOver ? (
        <GameOver scores={scores} current={current} onReset={resetGame} />
      ) : (
        <>
          <TurnBanner describer={describer.name} guesser={guesser.name} />
          {!current.imageUrl ? (
            <DescribeForm onSubmit={handleDescribe} player={describer} />
          ) : (
            <GuessForm onSubmit={handleGuess} player={guesser} imageUrl={current.imageUrl} />
          )}

          {current.rationale && (
            <div className="rationale">Judge: {current.rationale}</div>
          )}
        </>
      )}

      {loading && <div className="loading">{loading}</div>}
      {error && <div className="error">{error}</div>}

      <footer>
        <small>Backend health: <HealthBadge /></small>
      </footer>
    </div>
  )}

function Scoreboard({ scores }: { scores: Record<number, number> }) {
  return (
    <div className="scoreboard">
      <Score name="Jonas the Red" color="#d94a4a" value={scores[1]} />
      <Score name="Erna the Blue" color="#4a72d9" value={scores[2]} />
    </div>
  )
}

function Score({ name, color, value }: { name: string, color: string, value: number }) {
  return (
    <div className="score" style={{ borderColor: color }}>
      <div className="name" style={{ color }}>{name}</div>
      <div className="value">{value}</div>
    </div>
  )
}

function TurnBanner({ describer, guesser }: { describer: string, guesser: string }) {
  return (
    <div className="turn">
      <strong>{describer}</strong> describes. <strong>{guesser}</strong> guesses.
    </div>
  )
}

function DescribeForm({ onSubmit, player }: { onSubmit: (d: string) => void, player: Player }) {
  const [text, setText] = useState('')
  return (
    <div className="card">
      <h3 style={{ color: player.color }}>{player.name}, describe the scene</h3>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Describe a scene..." />
      <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>Generate Image</button>
    </div>
  )
}

function GuessForm({ onSubmit, player, imageUrl }: { onSubmit: (g: string) => void, player: Player, imageUrl: string }) {
  const [guess, setGuess] = useState('')
  return (
    <div className="card">
      <h3 style={{ color: player.color }}>{player.name}, describe what you see</h3>
      <img className="preview" src={imageUrl} alt="generated" />
      <textarea value={guess} onChange={e => setGuess(e.target.value)} rows={4} placeholder="Your description..." />
      <button disabled={!guess.trim()} onClick={() => onSubmit(guess.trim())}>Submit Guess</button>
    </div>
  )
}

function GameOver({ scores, current, onReset }: { scores: Record<number, number>, current: any, onReset: () => void }) {
  const winner = current.correct
    ? 'Guesser won by correctly describing the image!'
    : (scores[1] <= -100 || scores[2] <= -100) ? 'Game ended due to penalties.' : 'Game over.'
  return (
    <div className="card">
      <h2>Game Over</h2>
      <p>{winner}</p>
      <button onClick={onReset}>Play Again</button>
    </div>
  )
}

import { useEffect, useState as useState2 } from 'react'
function HealthBadge() {
  const [status, setStatus] = useState2<'ok' | 'down' | 'loading'>('loading')
  const [mock, setMock] = useState2<boolean>(false)
  useEffect(() => {
    let mounted = true
    api.health().then(j => {
      if (!mounted) return
      setStatus(j.ok ? 'ok' : 'down')
      setMock(!!j.data?.mock)
    }).catch(() => mounted && setStatus('down'))
    return () => { mounted = false }
  }, [])
  if (status === 'loading') return <span className="badge">checking...</span>
  return <span className={`badge ${status}`}>{status}{mock ? ' (mock)' : ''}</span>
}
