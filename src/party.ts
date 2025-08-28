// Lightweight confetti trigger using canvas-confetti
import confetti from 'canvas-confetti'

let burstTimeout: number | null = null
let streamInterval: number | null = null

export function partyBlast(durationMs = 3000, intensity = 1) {
  // Clear any previous scheduled bursts/streams
  if (burstTimeout) {
    clearTimeout(burstTimeout)
    burstTimeout = null
  }
  if (streamInterval) {
    clearInterval(streamInterval)
    streamInterval = null
  }

  const colors = ['#22d3ee', '#a78bfa', '#f472b6', '#f59e0b', '#10b981']
  const end = Date.now() + durationMs
  const base = Math.max(1, intensity)

  // Big opening burst from top-center
  confetti({
    particleCount: Math.round(160 * base),
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.25 },
    ticks: 180,
    colors,
  })

  // Continuous side streamers while the party lasts
  streamInterval = window.setInterval(() => {
    const timeLeft = end - Date.now()
    if (timeLeft <= 0) {
      if (streamInterval) clearInterval(streamInterval)
      streamInterval = null
      return
    }
    const particleCount = Math.round(8 * base)
    const y = 0.9
    confetti({
      particleCount,
      angle: 60,
      spread: 75,
      origin: { x: 0, y },
      colors,
      scalar: 1.1,
    })
    confetti({
      particleCount,
      angle: 120,
      spread: 75,
      origin: { x: 1, y },
      colors,
      scalar: 1.1,
    })
  }, 80)

  // Mid-party poppers: quick extra bursts from corners
  burstTimeout = window.setTimeout(() => {
    confetti({ particleCount: Math.round(90 * base), angle: 55, spread: 70, origin: { x: 0, y: 0.2 }, colors })
    confetti({ particleCount: Math.round(90 * base), angle: 125, spread: 70, origin: { x: 1, y: 0.2 }, colors })
  }, 500)
}

export function megaParty() {
  // One-time big burst center-top
  confetti({
  particleCount: 260,
  spread: 110,
  startVelocity: 50,
  origin: { y: 0.28 },
  ticks: 220,
  })
}
