"use client"
import type { BacktestResult } from "@/lib/strategy"

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-100"
  return (<div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"><div className="text-xs text-neutral-400">{label}</div><div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div></div>)
}

export function Results({ result }: { result: BacktestResult }) {
  const net = result.finalBalance - result.startBalance
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Solde final" value={`${result.finalBalance.toFixed(2)} $`} tone={net >= 0 ? "up" : "down"} />
        <Stat label="Résultat net" value={`${net >= 0 ? "+" : ""}${net.toFixed(2)} $`} tone={net >= 0 ? "up" : "down"} />
        <Stat label="Taux de réussite" value={`${result.winRate.toFixed(1)} %`} />
        <Stat label="Trades" value={`${result.wins + result.losses}`} />
        <Stat label="Gagnés / Perdus" value={`${result.wins} / ${result.losses}`} />
        <Stat label="Pertes consécutives max" value={`${result.maxConsecutiveLosses}`} tone="down" />
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Journal des trades ({result.trades.length})</div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-900 text-neutral-400"><tr className="text-left"><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Sens</th><th className="px-3 py-2 font-medium">Palier</th><th className="px-3 py-2 font-medium">Mise</th><th className="px-3 py-2 font-medium">Résultat</th><th className="px-3 py-2 font-medium">P&amp;L</th><th className="px-3 py-2 font-medium">Solde</th></tr></thead>
            <tbody>
              {result.trades.map((t, i) => (
                <tr key={i} className="border-t border-neutral-800/60">
                  <td className="px-3 py-1.5 text-neutral-500 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5"><span className={t.direction === "CALL" ? "text-emerald-400" : "text-red-400"}>{t.direction === "CALL" ? "▲ CALL" : "▼ PUT"}</span></td>
                  <td className="px-3 py-1.5 tabular-nums text-neutral-300">{t.step}</td>
                  <td className="px-3 py-1.5 tabular-nums text-neutral-300">{t.stake.toFixed(2)} $</td>
                  <td className="px-3 py-1.5"><span className={t.win ? "text-emerald-400" : "text-red-400"}>{t.win ? "Gagné" : "Perdu"}</span></td>
                  <td className={`px-3 py-1.5 tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-neutral-200">{t.balance.toFixed(2)}</td>
                </tr>
              ))}
              {result.trades.length === 0 ? (<tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-500">Aucun signal confirmé. Baisse le « Pourcentage d'ombre ».</td></tr>) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
