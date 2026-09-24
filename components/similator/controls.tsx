"use client"
import type { MartingaleParams, StrategyParams } from "@/lib/strategy"

type Props = { strategy: StrategyParams; martingale: MartingaleParams; onStrategy: (s: StrategyParams) => void; onMartingale: (m: MartingaleParams) => void }

function Field({ label, value, min, max, step = 1, suffix, onChange, hint }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        <span className="text-sm font-medium text-amber-400 tabular-nums">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amber-500" />
      {hint ? <span className="text-xs text-neutral-500 leading-snug">{hint}</span> : null}
    </label>
  )
}

export function Controls({ strategy, martingale, onStrategy, onMartingale }: Props) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Stratégie RSI 5s</h2>
        <Field label="Période RSI" value={strategy.rsiPeriod} min={2} max={30} onChange={(v) => onStrategy({ ...strategy, rsiPeriod: v })} />
        <Field label="Surachat (PUT)" value={strategy.overbought} min={55} max={95} onChange={(v) => onStrategy({ ...strategy, overbought: v })} />
        <Field label="Survente (CALL)" value={strategy.oversold} min={5} max={45} onChange={(v) => onStrategy({ ...strategy, oversold: v })} />
        <Field label="Pourcentage d'ombre" value={strategy.shadowPercent} min={0} max={80} suffix=" %" onChange={(v) => onStrategy({ ...strategy, shadowPercent: v })} hint="Taille minimale de la mèche. 0 = filtre désactivé." />
      </section>
      <section className="grid gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Martingale</h2>
        <Field label="Mise de base" value={martingale.baseAmount} min={1} max={50} suffix=" $" onChange={(v) => onMartingale({ ...martingale, baseAmount: v })} />
        <Field label="Multiplicateur" value={martingale.multiplier} min={1.5} max={3} step={0.1} suffix=" x" onChange={(v) => onMartingale({ ...martingale, multiplier: v })} />
        <Field label="Paliers max" value={martingale.maxSteps} min={0} max={6} onChange={(v) => onMartingale({ ...martingale, maxSteps: v })} />
        <Field label="Rendement (payout)" value={Math.round(martingale.payout * 100)} min={50} max={100} suffix=" %" onChange={(v) => onMartingale({ ...martingale, payout: v / 100 })} />
      </section>
    </div>
  )
}
