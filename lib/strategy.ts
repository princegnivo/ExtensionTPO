export type Candle = { time: number; open: number; high: number; low: number; close: number }
export type Direction = "CALL" | "PUT"

export type StrategyParams = {
  rsiPeriod: number
  overbought: number
  oversold: number
  shadowPercent: number
}

export type MartingaleParams = {
  baseAmount: number
  multiplier: number
  maxSteps: number
  payout: number
}

export const DEFAULT_STRATEGY: StrategyParams = {
  rsiPeriod: 14, overbought: 70, oversold: 30, shadowPercent: 30,
}

export const DEFAULT_MARTINGALE: MartingaleParams = {
  baseAmount: 1, multiplier: 2, maxSteps: 3, payout: 0.92,
}

export function computeRSI(closes: number[], period: number): number[] {
  const rsi = new Array<number>(closes.length).fill(Number.NaN)
  if (closes.length <= period) return rsi
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change >= 0) avgGain += change; else avgLoss -= change
  }
  avgGain /= period; avgLoss /= period
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change >= 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return rsi
}

export type WickInfo = {
  range: number; body: number; upperWick: number; lowerWick: number; upperPct: number; lowerPct: number
}

export function analyzeWick(candle: Candle): WickInfo {
  const range = candle.high - candle.low
  const bodyTop = Math.max(candle.open, candle.close)
  const bodyBottom = Math.min(candle.open, candle.close)
  const upperWick = candle.high - bodyTop
  const lowerWick = bodyBottom - candle.low
  const safeRange = range === 0 ? 1e-9 : range
  return {
    range, body: bodyTop - bodyBottom, upperWick, lowerWick,
    upperPct: (upperWick / safeRange) * 100, lowerPct: (lowerWick / safeRange) * 100,
  }
}

export type Signal = {
  index: number; time: number; direction: Direction
  rsi: number; prevRsi: number; wick: WickInfo
  price: number; confirmed: boolean; reason?: string
}

export function evaluateSignal(candles: Candle[], rsi: number[], index: number, params: StrategyParams): Signal | null {
  if (index < 1) return null
  const rsiNow = rsi[index], rsiPrev = rsi[index - 1]
  if (Number.isNaN(rsiNow) || Number.isNaN(rsiPrev)) return null
  const candle = candles[index]
  const wick = analyzeWick(candle)
  const crossedUp = rsiPrev < params.overbought && rsiNow >= params.overbought
  const crossedDown = rsiPrev > params.oversold && rsiNow <= params.oversold
  if (!crossedUp && !crossedDown) return null
  const direction: Direction = crossedUp ? "PUT" : "CALL"
  let confirmed = true, reason: string | undefined
  if (params.shadowPercent > 0) {
    if (direction === "PUT") {
      confirmed = wick.upperPct >= params.shadowPercent
      if (!confirmed) reason = `Mèche haute ${wick.upperPct.toFixed(0)}% < ${params.shadowPercent}%`
    } else {
      confirmed = wick.lowerPct >= params.shadowPercent
      if (!confirmed) reason = `Mèche basse ${wick.lowerPct.toFixed(0)}% < ${params.shadowPercent}%`
    }
  }
  return { index, time: candle.time, direction, rsi: rsiNow, prevRsi: rsiPrev, wick, price: candle.close, confirmed, reason }
}

export function findSignals(candles: Candle[], params: StrategyParams): Signal[] {
  const closes = candles.map((c) => c.close)
  const rsi = computeRSI(closes, params.rsiPeriod)
  const signals: Signal[] = []
  for (let i = 1; i < candles.length; i++) {
    const s = evaluateSignal(candles, rsi, i, params)
    if (s && s.confirmed) signals.push(s)
  }
  return signals
}

export type Trade = {
  index: number; time: number; direction: Direction
  step: number; stake: number; entry: number; exit: number
  win: boolean; pnl: number; balance: number
}

export type BacktestResult = {
  trades: Trade[]; wins: number; losses: number; winRate: number
  finalBalance: number; startBalance: number; maxDrawdown: number; maxConsecutiveLosses: number
}

export function backtest(
  candles: Candle[], strategy: StrategyParams, martingale: MartingaleParams, startBalance = 100,
): BacktestResult {
  const closes = candles.map((c) => c.close)
  const rsi = computeRSI(closes, strategy.rsiPeriod)
  const trades: Trade[] = []
  let balance = startBalance, step = 0, wins = 0, losses = 0
  let peak = startBalance, maxDrawdown = 0, consecutiveLosses = 0, maxConsecutiveLosses = 0

  for (let i = 1; i < candles.length - 1; i++) {
    const s = evaluateSignal(candles, rsi, i, strategy)
    if (!s || !s.confirmed) continue
    const stake = Number((martingale.baseAmount * Math.pow(martingale.multiplier, step)).toFixed(2))
    const entry = candles[i].close, exit = candles[i + 1].close
    const win = s.direction === "CALL" ? exit > entry : exit < entry
    const pnl = win ? Number((stake * martingale.payout).toFixed(2)) : -stake
    balance = Number((balance + pnl).toFixed(2))
    trades.push({ index: i, time: s.time, direction: s.direction, step, stake, entry, exit, win, pnl, balance })
    if (win) { wins++; step = 0; consecutiveLosses = 0 }
    else {
      losses++; consecutiveLosses++
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses)
      step = step + 1 > martingale.maxSteps ? 0 : step + 1
    }
    peak = Math.max(peak, balance)
    maxDrawdown = Math.max(maxDrawdown, peak - balance)
  }
  const total = wins + losses
  return {
    trades, wins, losses, winRate: total ? (wins / total) * 100 : 0,
    finalBalance: balance, startBalance, maxDrawdown, maxConsecutiveLosses,
  }
}

export function generateCandles(count: number, seed = 42, start = 1.1): Candle[] {
  let s = seed
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const candles: Candle[] = []
  let price = start
  const mean = start, now = Date.now()
  for (let i = 0; i < count; i++) {
    const open = price
    const drift = (mean - price) * 0.05
    const noise = (rand() - 0.5) * 0.0016
    let close = open + drift + noise
    const wickUp = rand() * 0.0011, wickDown = rand() * 0.0011
    const high = Math.max(open, close) + wickUp
    const low = Math.min(open, close) - wickDown
    close = Number(close.toFixed(5))
    candles.push({ time: now - (count - i) * 5000, open: Number(open.toFixed(5)), high: Number(high.toFixed(5)), low: Number(low.toFixed(5)), close })
    price = close
  }
  return candles
}
