export function elevationChangeMeters(elevations: number[], reversalMeters = 1) {
  if (elevations.length < 2) return { gain: 0, loss: 0 }

  let anchor = elevations[0]
  let extreme = anchor
  let direction: -1 | 0 | 1 = 0
  let gain = 0
  let loss = 0

  for (const value of elevations.slice(1)) {
    if (!Number.isFinite(value)) continue
    if (direction === 0) {
      if (value - anchor >= reversalMeters) { direction = 1; extreme = value }
      else if (anchor - value >= reversalMeters) { direction = -1; extreme = value }
    } else if (direction === 1) {
      extreme = Math.max(extreme, value)
      if (extreme - value >= reversalMeters) {
        gain += extreme - anchor
        anchor = extreme
        extreme = value
        direction = -1
      }
    } else {
      extreme = Math.min(extreme, value)
      if (value - extreme >= reversalMeters) {
        loss += anchor - extreme
        anchor = extreme
        extreme = value
        direction = 1
      }
    }
  }

  if (direction === 1) gain += extreme - anchor
  if (direction === -1) loss += anchor - extreme
  return { gain: Math.round(gain), loss: Math.round(loss) }
}
