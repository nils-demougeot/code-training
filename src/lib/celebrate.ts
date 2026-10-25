import confetti from 'canvas-confetti'

/** Confetti burst for a success. */
export function celebrate() {
  const colors = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24']
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors, disableForReducedMotion: true })
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true }), 180)
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true }), 300)
}
