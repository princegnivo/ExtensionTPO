"use client"
import type { Candle, Signal } from "@/lib/strategy"

type Props = { candles: Candle[]; rsi: number[]; signals: Signal[]; overbought: number; oversold: number }

export function CandleChart({ candles, rsi, signals, overbought, oversold }: Props) {
  if (candles.length === 0) return null
  const W = 900, priceH = 260, rsiH = 120, gap = 28, padX = 8
  const n = candles.length, slot = (W - padX * 2) / n, bodyW = Math.max(1.5, slot * 0.6)
  const highs = candles.map((c) => c.high), lows = candles.map((c) => c.low)
  const max = Math.max(...highs), min = Math.min(...lows), span = max - min || 1
  const yPrice = (p: number) => priceH - ((p - min) / span) * (priceH - 10) - 5
  const x = (i: number) => padX + i * slot + slot / 2
  const yRsi = (v: number) => priceH + gap + rsiH - (v / 100) * rsiH
  const signalByIndex = new Map(signals.map((s) => [s.index, s]))

  return (
    <svg viewBox={`0 0 ${W} ${priceH + gap + rsiH}`} className="w-full h-auto" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={0} x2={W} y1={5 + t * (priceH - 10)} y2={5 + t * (priceH - 10)} stroke="currentColor" className="text-neutral-800" strokeWidth={1} />
      ))}
      {candles.map((c, i) => {
        const up = c.close >= c.open, color = up ? "#10b981" : "#ef4444"
        const yO = yPrice(c.open), yC = yPrice(c.close)
        const top = Math.min(yO, yC), h = Math.max(1, Math.abs(yC - yO))
        return (<g key={i}><line x1={x(i)} x2={x(i)} y1={yPrice(c.high)} y2={yPrice(c.low)} stroke={color} strokeWidth={1} /><rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={h} fill={color} /></g>)
      })}
      {candles.map((c, i) => {
        const s = signalByIndex.get(i)
        if (!s) return null
        const isCall = s.direction === "CALL"
        const cy = isCall ? yPrice(c.low) + 12 : yPrice(c.high) - 12
        return (<g key={`sig-${i}`}><polygon points={isCall ? `${x(i)},${cy - 7} ${x(i) - 5},${cy + 4} ${x(i) + 5},${cy + 4}` : `${x(i)},${cy + 7} ${x(i) - 5},${cy - 4} ${x(i) + 5},${cy - 4}`} fill={isCall ? "#10b981" : "#ef4444"} stroke="#000" strokeWidth={0.5} /></g>)
      })}
      <rect x={0} y={priceH + gap} width={W} height={rsiH} fill="currentColor" className="text-neutral-900/40" />
      <line x1={0} x2={W} y1={yRsi(overbought)} y2={yRsi(overbought)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
      <line x1={0} x2={W} y1={yRsi(oversold)} y2={yRsi(oversold)} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
      <polyline fill="none" stroke="#38bdf8" strokeWidth={1.5} points={rsi.map((v, i) => (Number.isNaN(v) ? null : `${x(i)},${yRsi(v)}`)).filter(Boolean).join(" ")} />
    </svg>
  )
}
