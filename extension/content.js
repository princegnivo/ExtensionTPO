(function () {
  "use strict";
  const CANDLE_MS = 5000, MAX_CANDLES = 200, RENDER_THROTTLE_MS = 250;

  let settings = {
    strategy: Object.assign({}, window.POStrategy.DEFAULT_STRATEGY),
    martingale: Object.assign({}, window.POStrategy.DEFAULT_MARTINGALE),
    autoTrade: false, demoOnly: true,
    watchedPairs: ["EURUSD_otc", "GBPUSD_otc", "USDJPY_otc"], activePair: "EURUSD_otc",
    minPayout: 90, martingaleType: "classic",
    callSelectors: [".btn-call", "[class*='call']", "button[class*='call']", "[data-action='call']", ".button--call"],
    putSelectors: [".btn-put", "[class*='put']", "button[class*='put']", "[data-action='put']", ".button--put"],
    demoLabelSelectors: [".balance-info-block__mode", "[class*='demo']", "[class*='mode']", "[class*='account-type']"],
  };

  const candlesByPair = {}, currentByPair = {}, lastSignaledByPair = {}, latestSignalByPair = {};
  let mgStep = 0, sessionPnL = 0, wins = 0, losses = 0, consecutiveLossesInARow = 0;

  function injectHook() { try { const s = document.createElement("script"); s.src = chrome.runtime.getURL("inpage.js"); s.onload = () => s.remove(); (document.head || document.documentElement).appendChild(s); } catch (e) { console.warn("[PO Strategy] Injection inpage échouée", e); } }

  window.addEventListener("message", (event) => { if (event.source !== window) return; const msg = event.data; if (!msg || msg.source !== "PO_STRATEGY_TICK") return; onTick(msg.tick); });

  function onTick(tick) {
    const pair = tick.pair; if (!pair || !pair.toUpperCase().includes("_OTC")) return;
    if (!settings.watchedPairs.includes(pair)) { settings.watchedPairs.push(pair); persistSettings(); }
    if (!candlesByPair[pair]) candlesByPair[pair] = [];
    const bucket = Math.floor(tick.time / CANDLE_MS) * CANDLE_MS;
    let current = currentByPair[pair];
    if (!current || current.time !== bucket) {
      if (current) { candlesByPair[pair].push(current); if (candlesByPair[pair].length > MAX_CANDLES) candlesByPair[pair].shift(); onCandleClosed(pair); }
      currentByPair[pair] = { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price };
    } else { current.high = Math.max(current.high, tick.price); current.low = Math.min(current.low, tick.price); current.close = tick.price; }
    throttledRender();
  }

  function onCandleClosed(pair) {
    const candles = candlesByPair[pair];
    const sig = window.POStrategy.latestSignal(candles, settings.strategy, pair);
    if (sig) latestSignalByPair[pair] = sig;
    if (!sig || !sig.confirmed) return;
    if (lastSignaledByPair[pair] === sig.time) return;
    lastSignaledByPair[pair] = sig.time;
    notifySignal(pair, sig);
    if (settings.autoTrade && pair === settings.activePair) tryAutoTrade(sig);
  }

  let renderScheduled = false;
  function throttledRender() { if (renderScheduled) return; renderScheduled = true; setTimeout(() => { renderScheduled = false; render(); }, RENDER_THROTTLE_MS); }

  function isDemoAccount() { for (const sel of settings.demoLabelSelectors) { try { const el = document.querySelector(sel); if (el && /demo|démo|entrain|training/i.test(el.textContent || "")) return true; } catch (e) {} } return false; }
  function findButton(selectors) { for (const sel of selectors) { try { const btn = document.querySelector(sel); if (btn && btn.offsetParent !== null) return btn; } catch (e) {} } return null; }

  function simulateClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    try { const touch = new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: y, pageX: x + window.scrollX, pageY: y + window.scrollY, screenX: x, screenY: y }); el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] })); el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] })); } catch (e) {}
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })); el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })); el.click();
  }

  function tryAutoTrade(sig) {
    if (settings.demoOnly && !isDemoAccount()) { flash("Auto-trade bloqué : compte non-démo", "warn"); return; }
    if (settings.minPayout && settings.martingale.payout * 100 < settings.minPayout) { flash("Payout " + (settings.martingale.payout * 100).toFixed(0) + "% < " + settings.minPayout + "%", "warn"); return; }
    const amount = window.POStrategy.computeNextStake(settings.martingale.baseAmount, settings.martingale.multiplier, mgStep, consecutiveLossesInARow, settings.martingaleType);
    setAmount(amount);
    const selectors = sig.direction === "CALL" ? settings.callSelectors : settings.putSelectors;
    const btn = findButton(selectors);
    if (!btn) { flash("Bouton introuvable (" + selectors[0] + ")", "warn"); return; }
    simulateClick(btn);
    flash((sig.direction === "CALL" ? "▲ CALL" : "▼ PUT") + " placé — mise " + amount + "$ (palier " + mgStep + ")", "ok");
  }

  function setAmount(amount) {
    const selectors = ['input[type="text"][inputmode="numeric"]', ".value__val input", "input.amount", 'input[inputmode="decimal"]', 'input[type="number"]'];
    let input = null; for (const sel of selectors) { const f = document.querySelector(sel); if (f) { input = f; break; } }
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, String(amount)); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function reportResult(win) {
    const stake = window.POStrategy.computeNextStake(settings.martingale.baseAmount, settings.martingale.multiplier, mgStep, consecutiveLossesInARow, settings.martingaleType);
    if (win) { wins++; sessionPnL += stake * settings.martingale.payout; mgStep = 0; consecutiveLossesInARow = 0; }
    else { losses++; sessionPnL -= stake; consecutiveLossesInARow++; mgStep = mgStep + 1 > settings.martingale.maxSteps ? 0 : mgStep + 1; }
    render();
  }

  let root;
  function buildOverlay() {
    if (document.getElementById("po-strategy-overlay")) return;
    root = document.createElement("div"); root.id = "po-strategy-overlay";
    root.innerHTML = '<div class="pos-head"><span class="pos-dot"></span><strong id="pos-title">RSI 5s</strong><button id="pos-min" title="Réduire">–</button></div><div class="pos-body"><div class="pos-row"><span>Paire</span><select id="pos-pair"></select></div><div class="pos-row"><span>RSI</span><b id="pos-rsi">—</b></div><div class="pos-row"><span>Signal</span><b id="pos-signal">En attente…</b></div><div class="pos-row"><span>Palier</span><b id="pos-step">0</b></div><div class="pos-row"><span>Session</span><b id="pos-pnl">0.00 $</b></div><div class="pos-row"><span>W / L</span><b id="pos-wl">0 / 0</b></div><div class="pos-row"><span>Auto</span><b id="pos-auto" class="off">OFF</b></div><div class="pos-actions"><button id="pos-win" class="ok">Gagné</button><button id="pos-loss" class="bad">Perdu</button></div><div class="pos-note">Compte démo recommandé.</div></div>';
    document.body.appendChild(root);
    const select = root.querySelector("#pos-pair");
    for (const p of window.POStrategy.COMMON_PAIRS) { const opt = document.createElement("option"); opt.value = p.id; opt.textContent = p.label; select.appendChild(opt); }
    select.value = settings.activePair;
    select.addEventListener("change", () => { settings.activePair = select.value; if (!settings.watchedPairs.includes(select.value)) { settings.watchedPairs.push(select.value); persistSettings(); } window.POStrategy.resetCache(); render(); });
    root.querySelector("#pos-win").addEventListener("click", () => reportResult(true));
    root.querySelector("#pos-loss").addEventListener("click", () => reportResult(false));
    root.querySelector("#pos-min").addEventListener("click", () => root.classList.toggle("min"));
    makeDraggable(root); restorePosition(root);
  }

  function makeDraggable(el) {
    let startX, startY, startLeft, startTop, dragging = false;
    const head = el.querySelector(".pos-head"); if (!head) return;
    function onStart(e) { const touch = e.touches ? e.touches[0] : e; startX = touch.clientX; startY = touch.clientY; const rect = el.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top; dragging = false; head.addEventListener("touchmove", onMove, { passive: false }); head.addEventListener("mousemove", onMove); document.addEventListener("touchend", onEnd); document.addEventListener("mouseup", onEnd); }
    function onMove(e) { const touch = e.touches ? e.touches[0] : e; const dx = touch.clientX - startX, dy = touch.clientY - startY; if (Math.abs(dx) + Math.abs(dy) > 5) dragging = true; if (!dragging) return; e.preventDefault(); el.style.left = (startLeft + dx) + "px"; el.style.top = (startTop + dy) + "px"; el.style.right = "auto"; }
    function onEnd() { head.removeEventListener("touchmove", onMove); head.removeEventListener("mousemove", onMove); document.removeEventListener("touchend", onEnd); document.removeEventListener("mouseup", onEnd); if (dragging) savePosition(el); }
    head.addEventListener("touchstart", onStart, { passive: true }); head.addEventListener("mousedown", onStart);
  }

  function savePosition(el) { const rect = el.getBoundingClientRect(); chrome.storage.local.set({ poOverlayPos: { left: rect.left, top: rect.top, right: "auto" } }); }
  function restorePosition(el) { chrome.storage.local.get("poOverlayPos", (data) => { if (data && data.poOverlayPos) { const p = data.poOverlayPos; if (typeof p.left === "number") el.style.left = p.left + "px"; if (typeof p.top === "number") el.style.top = p.top + "px"; el.style.right = "auto"; } }); }

  function render() {
    if (!root) return;
    const pair = settings.activePair, candles = candlesByPair[pair] || [];
    let lastRsi = NaN;
    if (candles.length) { const closes = candles.map((c) => c.close); const rsiVals = window.POStrategy.computeRSICached(closes, settings.strategy.rsiPeriod, pair); lastRsi = rsiVals[rsiVals.length - 1]; }
    root.querySelector("#pos-title").textContent = "RSI 5s · " + pair;
    root.querySelector("#pos-rsi").textContent = Number.isNaN(lastRsi) ? "—" : lastRsi.toFixed(1);
    const sig = latestSignalByPair[pair], sigEl = root.querySelector("#pos-signal");
    if (sig) { if (sig.confirmed) { sigEl.textContent = sig.direction === "CALL" ? "▲ CALL" : "▼ PUT"; sigEl.className = sig.direction === "CALL" ? "sig-call" : "sig-put"; } else { sigEl.textContent = "Non confirmé"; sigEl.className = "sig-none"; } } else { sigEl.textContent = "En attente…"; sigEl.className = "sig-none"; }
    root.querySelector("#pos-step").textContent = String(mgStep);
    const pnlEl = root.querySelector("#pos-pnl"); pnlEl.textContent = (sessionPnL >= 0 ? "+" : "") + sessionPnL.toFixed(2) + " $"; pnlEl.className = sessionPnL >= 0 ? "ok" : "bad";
    root.querySelector("#pos-wl").textContent = wins + " / " + losses;
    const auto = root.querySelector("#pos-auto"); auto.textContent = settings.autoTrade ? "ON" : "OFF"; auto.className = settings.autoTrade ? "on" : "off";
  }

  function notifySignal(pair, sig) { flash((sig.direction === "CALL" ? "▲ CALL" : "▼ PUT") + " " + pair + " · RSI " + sig.rsi.toFixed(1) + " · mèche " + (sig.direction === "PUT" ? sig.wick.upperPct.toFixed(0) : sig.wick.lowerPct.toFixed(0)) + "%", sig.direction === "CALL" ? "ok" : "bad"); }

  let flashTimer;
  function flash(text, tone) { let f = document.getElementById("po-strategy-flash"); if (!f) { f = document.createElement("div"); f.id = "po-strategy-flash"; document.body.appendChild(f); } f.textContent = text; f.className = "show " + (tone || ""); clearTimeout(flashTimer); flashTimer = setTimeout(() => { f.className = ""; }, 4000); }

  function loadSettings() { chrome.storage.local.get("poStrategySettings", (data) => { if (data && data.poStrategySettings) { const v = data.poStrategySettings; settings = Object.assign(settings, v); settings.strategy = Object.assign({}, window.POStrategy.DEFAULT_STRATEGY, v.strategy); settings.martingale = Object.assign({}, window.POStrategy.DEFAULT_MARTINGALE, v.martingale); if (Array.isArray(v.watchedPairs) && v.watchedPairs.length) settings.watchedPairs = v.watchedPairs; if (v.activePair) settings.activePair = v.activePair; if (v.minPayout) settings.minPayout = v.minPayout; if (v.martingaleType) settings.martingaleType = v.martingaleType; } if (root) { const select = root.querySelector("#pos-pair"); if (select) select.value = settings.activePair; } render(); }); }

  function persistSettings() { chrome.storage.local.set({ poStrategySettings: settings }); }

  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.poStrategySettings) { const v = changes.poStrategySettings.newValue || {}; settings = Object.assign(settings, v); settings.strategy = Object.assign({}, window.POStrategy.DEFAULT_STRATEGY, v.strategy); settings.martingale = Object.assign({}, window.POStrategy.DEFAULT_MARTINGALE, v.martingale); if (Array.isArray(v.watchedPairs) && v.watchedPairs.length) settings.watchedPairs = v.watchedPairs; if (v.activePair) settings.activePair = v.activePair; window.POStrategy.resetCache(); if (root) { const select = root.querySelector("#pos-pair"); if (select) select.value = settings.activePair; } render(); } });

  function init() { injectHook(); buildOverlay(); loadSettings(); render(); console.log("[PO Strategy] content script prêt (multi-paires OTC)"); }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
