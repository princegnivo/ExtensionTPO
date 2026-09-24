const DEFAULTS = {
  strategy: { rsiPeriod: 14, overbought: 70, oversold: 30, shadowPercent: 30 },
  martingale: { baseAmount: 1, multiplier: 2, maxSteps: 3, payout: 0.92 },
  autoTrade: false,
  demoOnly: true,
  watchedPairs: ["EURUSD_otc", "GBPUSD_otc", "USDJPY_otc"],
  activePair: "EURUSD_otc",
  minPayout: 90,
  martingaleType: "classic",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("poStrategySettings", (data) => {
    if (!data || !data.poStrategySettings) chrome.storage.local.set({ poStrategySettings: DEFAULTS });
  });
});
