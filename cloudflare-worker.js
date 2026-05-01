/**
 * Cloudflare Workers — 行情中转服务（支持 Binance + OKX）
 *
 * 功能：
 *   - 中转 Binance / OKX API 请求，解决 GitHub Pages CORS 问题
 *   - 自动添加 CORS 响应头，允许任意域名访问
 *   - 支持 /price      → Binance 行情（批量查询）
 *   - 支持 /okx-price  → OKX 行情（逐个查询，返回聚合结果）
 *   - 支持 /ping       → 健康检查
 *
 * 部署方式：见项目 README
 */

// ============================================================
// 配置
// ============================================================
const ALLOWED_ORIGIN = '*';  // 可改为 'https://willimas0521.github.io'
const BINANCE_BASE  = 'https://api.binance.com';
const OKX_BASE      = 'https://www.okx.com';

const WORKER_OKX_INSTS = ['BTC-USDT','ETH-USDT','SOL-USDT','BNB-USDT','DOGE-USDT','XRP-USDT'];

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
      return handleOkxPrice();
    }

    return corsResponse(JSON.stringify({ error: 'Not found', path }), 404);
  }
};

// ============================================================
// /price — Binance 行情（批量查询）
// 参数: ?symbols=BTCUSDT,ETHUSDT,...
// ============================================================
async function handleBinancePrice(url) {
  try {
    const symbolsParam = url.searchParams.get('symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,DOGEUSDT,XRPUSDT';
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    const symsJson = JSON.stringify(symbols);
    const apiUrl   = `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symsJson)}`;

    const resp = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CFWorker/1.0' },
      signal:  AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return corsResponse(JSON.stringify({ error: 'Binance error', status: resp.status }), 502);
    }

    return corsResponse(JSON.stringify(await resp.json()), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: 'Worker failed', message: e.message }), 500);
  }
}

// ============================================================
// /okx-price — OKX 行情（逐个查询，返回聚合结果）
// 说明: 逐个查询每个交易对的 /market/ticker，
//       合并返回 data 数组，避免全部 SPOT 的巨大数据量
// ============================================================
async function handleOkxPrice() {
  try {
    const allData = [];

    for (const inst of WORKER_OKX_INSTS) {
      const apiUrl = `${OKX_BASE}/api/v5/market/ticker?instId=${encodeURIComponent(inst)}`;
      try {
        const resp = await fetch(apiUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'CFWorker/1.0' },
          signal: AbortSignal.timeout(6000),
        });

        if (!resp.ok) continue;

        const json = await resp.json();
        if (json.code === '0' && json.data && json.data.length > 0) {
          allData.push(json.data[0]);
        }
      } catch (_) {
        // 单个失败跳过，继续下一个
      }
    }

    if (allData.length === 0) {
      return corsResponse(JSON.stringify({ code: '-1', msg: 'No data' }), 200);
    }

    return corsResponse(JSON.stringify({ code: '0', data: allData }), 200);

  } catch (e) {
    return corsResponse(JSON.stringify({ error: 'OKX Worker failed', message: e.message }), 500);
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
