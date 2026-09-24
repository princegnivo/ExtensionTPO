(function () {
  "use strict";
  const DEF = {
    strategy: Object.assign({}, window.POStrategy.DEFAULT_STRATEGY),
    martingale: Object.assign({}, window.POStrategy.DEFAULT_MARTINGALE),
    autoTrade: false, demoOnly: true,
    watchedPairs: ["EURUSD_otc", "GBPUSD_otc", "USDJPY_otc"], activePair: "EURUSD_otc",
    minPayout: 90, martingaleType: "classic",
  };
  const $ = (id) => document.getElementById(id);
  const rangeIds = ["rsiPeriod", "overbought", "oversold", "shadowPercent", "baseAmount", "multiplier", "maxSteps", "payout"];

  function buildPairsList(selected) {
    const container = $("pairsList"); container.innerHTML = "";
    for (const p of window.POStrategy.COMMON_PAIRS) {
      const label = document.createElement("label");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = p.id;
      cb.checked = selected.includes(p.id); cb.addEventListener("change", save);
      label.appendChild(cb); label.appendChild(document.createTextNode(p.label)); container.appendChild(label);
    }
  }

  function getSelectedPairs() { const out = []; document.querySelectorAll("#pairsList input[type='checkbox']:checked").forEach((cb) => out.push(cb.value)); return out; }

  function fill(s) {
    $("rsiPeriod").value = s.strategy.rsiPeriod; $("overbought").value = s.strategy.overbought;
    $("oversold").value = s.strategy.oversold; $("shadowPercent").value = s.strategy.shadowPercent;
    $("baseAmount").value = s.martingale.baseAmount; $("multiplier").value = s.martingale.multiplier;
    $("maxSteps").value = s.martingale.maxSteps; $("payout").value = Math.round(s.martingale.payout * 100);
    $("autoTrade").checked = !!s.autoTrade; $("demoOnly").checked = !!s.demoOnly;
    $("minPayout").value = s.minPayout || 90;
    const mgType = document.querySelector(`input[name="mgType"][value="${s.martingaleType || "classic"}"]`);
    if (mgType) mgType.checked = true;
    $("callSelector").value = s.callSelector || ""; $("putSelector").value = s.putSelector || ""; $("demoLabelSelector").value = s.demoLabelSelector || "";
    buildPairsList(s.watchedPairs || []); updateLabels();
  }

  function updateLabels() {
    $("rsiPeriodVal").textContent = $("rsiPeriod").value; $("overboughtVal").textContent = $("overbought").value;
    $("oversoldVal").textContent = $("oversold").value; $("shadowPercentVal").textContent = $("shadowPercent").value + " %";
    $("baseAmountVal").textContent = $("baseAmount").value + " $"; $("multiplierVal").textContent = $("multiplier").value + " x";
    $("maxStepsVal").textContent = $("maxSteps").value; $("payoutVal").textContent = $("payout").value + " %";
    $("minPayoutVal").textContent = $("minPayout").value + " %";
  }

  function collect() {
    const watchedPairs = getSelectedPairs();
    const out = {
      strategy: { rsiPeriod: Number($("rsiPeriod").value), overbought: Number($("overbought").value), oversold: Number($("oversold").value), shadowPercent: Number($("shadowPercent").value) },
      martingale: { baseAmount: Number($("baseAmount").value), multiplier: Number($("multiplier").value), maxSteps: Number($("maxSteps").value), payout: Number($("payout").value) / 100 },
      autoTrade: $("autoTrade").checked, demoOnly: $("demoOnly").checked,
      watchedPairs, activePair: watchedPairs[0] || "EURUSD_otc",
      minPayout: Number($("minPayout").value),
      martingaleType: document.querySelector('input[name="mgType"]:checked')?.value || "classic",
    };
    const cs = $("callSelector").value.trim(), ps = $("putSelector").value.trim(), ds = $("demoLabelSelector").value.trim();
    if (cs) out.callSelector = cs; if (ps) out.putSelector = ps; if (ds) out.demoLabelSelector = ds;
    return out;
  }

  let saveTimer;
  function save() {
    const s = collect();
    chrome.storage.local.set({ poStrategySettings: s }, () => {
      const status = $("status"); status.textContent = "Enregistré ✓";
      clearTimeout(saveTimer); saveTimer = setTimeout(() => (status.textContent = ""), 1500);
    });
  }

  function bind() {
    rangeIds.forEach((id) => $(id).addEventListener("input", () => { updateLabels(); save(); }));
    ["autoTrade", "demoOnly", "callSelector", "putSelector", "demoLabelSelector"].forEach((id) => $(id).addEventListener("change", save));
    $("minPayout").addEventListener("input", () => { updateLabels(); save(); });
    document.querySelectorAll('input[name="mgType"]').forEach((r) => r.addEventListener("change", save));
    $("reset").addEventListener("click", () => { chrome.storage.local.set({ poStrategySettings: DEF }, () => fill(DEF)); });
  }

  chrome.storage.local.get("poStrategySettings", (data) => {
    const s = (data && data.poStrategySettings) || {};
    const merged = Object.assign({}, DEF, s);
    merged.strategy = Object.assign({}, DEF.strategy, s.strategy);
    merged.martingale = Object.assign({}, DEF.martingale, s.martingale);
    merged.watchedPairs = (Array.isArray(s.watchedPairs) && s.watchedPairs.length) ? s.watchedPairs : DEF.watchedPairs;
    fill(merged); bind();
  });
})();
