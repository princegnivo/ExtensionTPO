(function () {
  "use strict";
  function post(tick) { window.postMessage({ source: "PO_STRATEGY_TICK", tick }, "*"); }
  function normalizePair(raw) {
    if (!raw || typeof raw !== "string") return null;
    return raw.replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
  }
  function deepFindTick(node, depth) {
    if (depth > 6 || node == null) return null;
    if (Array.isArray(node)) {
      if (node.length >= 3 && typeof node[0] === "string" && typeof node[1] === "number" && typeof node[2] === "number") {
        const pair = normalizePair(node[0]); if (!pair) return null;
        const ts = node[1] > 1e12 ? node[1] : node[1] * 1000;
        return { pair, price: node[2], time: ts };
      }
      for (let i = 0; i < node.length; i++) { const r = deepFindTick(node[i], depth + 1); if (r) return r; }
    } else if (typeof node === "object") {
      const pair = normalizePair(node.asset || node.symbol || node.pair);
      const price = node.price ?? node.value ?? node.rate;
      const time = node.time ?? node.ts ?? node.timestamp;
      if (pair && typeof price === "number" && (typeof time === "number" || typeof time === "string")) {
        const ts = typeof time === "string" ? Date.parse(time) : (time > 1e12 ? time : time * 1000);
        if (isFinite(ts)) return { pair, price, time: ts };
      }
      for (const k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) { const r = deepFindTick(node[k], depth + 1); if (r) return r; } }
    }
    return null;
  }
  function extractTick(data) {
    if (typeof data === "string") {
      const s1 = data.indexOf("["), s2 = data.indexOf("{");
      const idx = s1 === -1 ? s2 : (s2 === -1 ? s1 : Math.min(s1, s2));
      if (idx === -1) return null;
      try { return deepFindTick(JSON.parse(data.slice(idx)), 0); } catch (e) { return null; }
    } else if (typeof data === "object") return deepFindTick(data, 0);
    return null;
  }
  const NativeWS = window.WebSocket;
  function PatchedWS(url, protocols) {
    const ws = protocols ? new NativeWS(url, protocols) : new NativeWS(url);
    ws.addEventListener("message", (event) => { try { const tick = extractTick(event.data); if (tick && isFinite(tick.price)) post(tick); } catch (e) {} });
    return ws;
  }
  PatchedWS.prototype = NativeWS.prototype;
  PatchedWS.CONNECTING = NativeWS.CONNECTING; PatchedWS.OPEN = NativeWS.OPEN;
  PatchedWS.CLOSING = NativeWS.CLOSING; PatchedWS.CLOSED = NativeWS.CLOSED;
  try { window.WebSocket = PatchedWS; console.log("[PO Strategy] hook WS installé"); } catch (e) { console.warn("[PO Strategy] WS patch failed", e); }
})();
