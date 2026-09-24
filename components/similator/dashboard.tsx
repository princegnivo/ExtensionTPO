"use client"
import { useMemo, useState } from "react"
import { backtest, computeRSI, DEFAULT_MARTINGALE, DEFAULT_STRATEGY, findSignals, generateCandles, type MartingaleParams, type StrategyParams } from "@/lib/strategy"
import { CandleChart } from "./candle-chart"
import { Controls } from "./controls"
import { Results } from "./results"

export function Dashboard() {
  const [strategy, setStrategy] = useState<StrategyParams>(DEFAULT_STRATEGY)
  const [martingale, setMartingale] = useState<MartingaleParams>(DEFAULT_MARTINGALE)
  const [seed, setSeed] = useState(42)
  const [count] = useState(120)
  const candles = useMemo(() => generateCandles(count, seed), [count, seed])
  const rsi = useMemo(() => computeRSI(candles.map((c) => c.close), strategy.rsiPeriod), [candles, strategy.rsiPeriod])
  const signals = useMemo(() => findSignals(candles, strategy), [candles, strategy])
  const result = useMemo(() => backtest(candles, strategy, martingale), [candles, strategy, martingale])

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Pocket Option · Mémoire</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Simulateur — Stratégie RSI 5s + Martingale</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">RSI confirmé par la mèche de la dernière bougie et gestion martingale.</p>
          </div>
          <button onClick={() => setSeed((s) => s + 1)} className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800">Nouveau jeu de bougies</button>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="mb-3 flex items-center gap-4 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Haussière</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Baissière</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-sky-400" /> RSI</span>
                <span className="ml-auto tabular-nums">{signals.length} signal(aux) confirmé(s)</span>
              </div>
              <CandleChart candles={candles} rsi={rsi} signals={signals} overbought={strategy.overbought} oversold={strategy.oversold} />
            </div>
            <Results result={result} />
          </div>
          <aside className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <Controls strategy={strategy} martingale={martingale} onStrategy={setStrategy} onMartingale={setMartingale} />
          </aside>
        </div>
        <footer className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/80">
          <strong className="text-amber-300">Avertissement :</strong> outil éducatif de démonstration et de backtest. Les options binaires comportent un risque élevé de perte en capital.
        </footer>
      </div>
    </div>
  )
}
