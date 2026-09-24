(function () {
  "use strict";
  const DEFAULT_STRATEGY = { rsiPeriod: 14, overbought: 70, oversold: 30, shadowPercent: 30 };
  const DEFAULT_MARTINGALE = { baseAmount: 1, multiplier: 2, maxSteps: 3, payout: 0.92 };
  const COMMON_PAIRS = [
    { id: "EURUSD_otc", label: "EUR/USD OTC" },
    { id: "GBPUSD_otc", label: "GBP/USD OTC" },
    { id: "USDJPY_otc", label: "USD/JPY OTC" },
    { id: "AUDUSD_otc", label: "AUD/USD OTC" },
    { id: "USDCAD_otc", label: "USD/CAD OTC" },
    { id: "USDCHF_otc", label: "USD/CHF OTC" },
    { id: "NZDUSD_otc", label: "NZD/USD OTC" },
    { id: "EURGBP_otc", label: "EUR/GBP OTC" },
    { id: "EURJPY_otc", label: "EUR/JPY OTC" },
    { id: "GBPJPY_otc", label: "GBP/JPY OTC" },
    { id: "BTCUSD_otc", label: "BTC/USD OTC" },
    { id: "ETHUSD_otc", label: "ETH/USD OTC" },
    { id: "XAUUSD_otc", label: "Or (XAU/USD) OTC" },
  ];
  const MARTINGALE_TYPES = { CLASSIC: "classic", GRANDE: "grande", PIQUEMOUCHE: "piquemouche" };
  const rsiCache = new Map();

  function computeRSI(closes, period) {
    const rsi = new Array(closes.length).fill(NaN);
    if (closes.length <= period) return rsi;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) { const c = closes[i] - closes[i - 1]; if (c >= 0) avgGain += c; else avgLoss -= c; }
    avgGain /= period; avgLoss /= period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
      const c = closes[i] - closes[i - 1], g = c >= 0 ? c : 0, l = c < 0 ? -c : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return rsi;
  }

  function computeRSICached(closes, period, cacheKey) {
    const key = cacheKey || ("p" + period);
    let state = rsiCache.get(key);
    if (!state || state.lastLen > closes.length || state.lastLen === 0) {
      const rsi = computeRSI(closes, period);
      if (closes.length > period) {
        let avgGain = 0, avgLoss = 0;
        for (let i = 1; i <= period; i++) { const c = closes[i] - closes[i - 1]; if (c >= 0) avgGain += c; else avgLoss -= c; }
        avgGain /= period; avgLoss /= period;
        for (let i = period + 1; i < closes.length; i++) { const c = closes[i] - closes[i - 1], g = c >= 0 ? c : 0, l = c < 0 ? -c : 0; avgGain = (avgGain * (period - 1) + g) / period; avgLoss = (avgLoss * (period - 1) + l) / period; }
        rsiCache.set(key, { avgGain, avgLoss, lastLen: closes.length, rsi });
      }
      return rsi;
    }
    const prevRsi = state.rsi || computeRSI(closes.slice(0, state.lastLen), period);
    const rsi = new Array(closes.length).fill(NaN);
    for (let i = 0; i < state.lastLen; i++) rsi[i] = prevRsi[i];
    let { avgGain, avgLoss } = state;
    for (let i = state.lastLen; i < closes.length; i++) { const c = closes[i] - closes[i - 1], g = c >= 0 ? c : 0, l = c < 0 ? -c : 0; avgGain = (avgGain * (period - 1) + g) / period; avgLoss = (avgLoss * (period - 1) + l) / period; rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); }
    rsiCache.set(key, { avgGain, avgLoss, lastLen: closes.length, rsi });
    return rsi;
  }

  function analyzeWick(c) {
    const range = c.high - c.low, bodyTop = Math.max(c.open, c.close), bodyBottom = Math.min(c.open, c.close);
    const upperWick = c.high - bodyTop, lowerWick = bodyBottom - c.low, safe = range === 0 ? 1e-9 : range;
    return { range, body: bodyTop - bodyBottom, upperWick, lowerWick, upperPct: (upperWick / safe) * 100, lowerPct: (lowerWick / safe) * 100 };
  }

  function evaluateSignal(candles, rsi, index, params) {
    if (index < 1) return null;
    const rsiNow = rsi[index], rsiPrev = rsi[index - 1];
    if (Number.isNaN(rsiNow) || Number.isNaN(rsiPrev)) return null;
    const candle = candles[index], wick = analyzeWick(candle);
    const crossedUp = rsiPrev < params.overbought && rsiNow >= params.overbought;
    const crossedDown = rsiPrev > params.oversold && rsiNow <= params.oversold;
    if (!crossedUp && !crossedDown) return null;
    const direction = crossedUp ? "PUT" : "CALL";
    let confirmed = true, reason;
    if (params.shadowPercent > 0) {
      if (direction === "PUT") { confirmed = wick.upperPct >= params.shadowPercent; if (!confirmed) reason = "Mèche haute " + wick.upperPct.toFixed(0) + "%"; }
      else { confirmed = wick.lowerPct >= params.shadowPercent; if (!confirmed) reason = "Mèche basse " + wick.lowerPct.toFixed(0) + "%"; }
    }
    return { index, time: candle.time, direction, rsi: rsiNow, prevRsi: rsiPrev, wick, price: candle.close, confirmed, reason };
  }

  function latestSignal(candles, params, cacheKey) {
    if (!candles || candles.length < params.rsiPeriod + 2) return null;
    const closes = candles.map((c) => c.close);
    const rsi = computeRSICached(closes, params.rsiPeriod, cacheKey);
    return evaluateSignal(candles, rsi, candles.length - 1, params);
  }

  function resetCache(cacheKey) { if (cacheKey) rsiCache.delete(cacheKey); else rsiCache.clear(); }

  function computeNextStake(baseAmount, multiplier, step, lossesInARow, type) {
    let stake = baseAmount;
    if (type === MARTINGALE_TYPES.CLASSIC) stake = baseAmount * Math.pow(multiplier, step);
    else if (type === MARTINGALE_TYPES.GRANDE) { let s = baseAmount; for (let i = 0; i < step; i++) s = s * multiplier + baseAmount; stake = s; }
    else if (type === MARTINGALE_TYPES.PIQUEMOUCHE) { if (lossesInARow < 3) stake = baseAmount * (lossesInARow + 1); else stake = baseAmount * Math.pow(multiplier, lossesInARow); }
    return Number(stake.toFixed(2));
  }

  window.POStrategy = { DEFAULT_STRATEGY, DEFAULT_MARTINGALE, COMMON_PAIRS, MARTINGALE_TYPES, computeRSI, computeRSICached, analyzeWick, evaluateSignal, latestSignal, resetCache, computeNextStake };
})();
