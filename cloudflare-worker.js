/**
 * Cloudflare Workers — 行情中转服务（支持 Binance + OKX）
 *
 * 功能：
 *   - 中转 Binance / OKX API 请求，解决 GitHub Pages CORS 问题
 *   - 自动添加 CORS 响应头，允许任意域名访问
 *   - 支持 /price      → Binance 行情
 *   - 支持 /okx-price  → OKX 行情
 *   - 支持 /ping       → 健康检查
 *
 * 部署方式：见项目 README
 */

// ============================================================
// 配置
// ============================================================
const ALLOWED_ORIGIN = '*';  // 可改为 'https://willimas0521.github.io'
const BINANCE_BASE   = 'https://api.binance.com';
const OKX_BASE       = 'https://www.okx.com';

// OKX instId 映射表（用于 /okx-price 接口）
const OKX_MAP = {
  'BTCUSDT': 'BTC-USDT', 'ETHUSDT': 'ETH-USDT', 'SOLUSDT': 'SOL-USDT',
  'BNBUSDT': 'BNB-USDT',  'DOGEUSDT': 'DOGE-USDT', 'XRPUSDT': 'XRP-USDT',
};

// ============================================================
// 主入口
// ============================================================
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    if (path === '/ping') {
      return corsResponse(JSON.stringify({ ok: true, time: Date.now() }), 200);
    }

    if (path === '/price') {
      return handleBinancePrice(url);
    }

    if (path === '/okx-price') {
      return handleOkxPrice(url);
    }

    return corsResponse(JSON.stringify({ error: 'Not found', path }), 404);
  }
};

// ============================================================
// /price  — Binance 行情
// 参数: ?symbols=BTCUSDT,ETHUSDT,...
// ============================================================
async function handleBinancePrice(url) {
  try {
    const symbolsParam = url.searchParams.get('symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,DOGEUSDT,XRPUSDT';
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    const symsJson   = JSON.stringify(symbols);
    const apiUrl     = `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symsJson)}`;

    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CFWorker/1.0' },
      signal:  AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return corsResponse(JSON.stringify({ error: 'Binance API error', status: resp.status, detail: errText }), 502);
    }

    return corsResponse(JSON.stringify(await resp.json()), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: 'Worker fetch failed', message: e.message }), 500);
  }
}

// ============================================================
// /okx-price  — OKX 行情
// 参数: ?instIds=BTC-USDT,ETH-USDT,...  (可选，默认全部)
//       ?symbols=BTCUSDT,ETHUSDT,...    (Binance 格式别名，自动转换)
// ============================================================
async function handleOkxPrice(url) {
  try {
    // 支持两种参数格式
    let instIds = url.searchParams.get('instIds') || '';

    // 如果传的是 Binance 格式 symbols，自动转换
    const symbolsParam = url.searchParams.get('symbols');
    if (symbolsParam && !instIds) {
      instIds = symbolsParam.split(',')
        .map(s => OKX_MAP[s.trim().toUpperCase()] || s.trim())
        .join(',');
    }

    // 默认查全部主流币
    if (!instIds) {
      instIds = Object.values(OKX_MAP).join(',');
    }

    const apiUrl = `${OKX_BASE}/api/v5/market/tickers?instType=SPOT&instId=${encodeURIComponent(instIds)}`;

    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CFWorker/1.0' },
      signal:  AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return corsResponse(JSON.stringify({ error: 'OKX API error', status: resp.status, detail: errText }), 502);
    }

    return corsResponse(JSON.stringify(await resp.json()), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: 'Worker OKX fetch failed', message: e.message }), 500);
  }
}

// ============================================================
// 辅助：CORS 响应
// ============================================================
function corsResponse(body, status) {
  const headers = {
    'Content-Type':   'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':  'no-cache',
  };
  if (body === null) return new Response(null, { status, headers });
  return new Response(body, { status, headers });
}
