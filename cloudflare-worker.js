/**
 * Cloudflare Workers — Binance 行情中转服务
 * 
 * 功能：
 *   - 中转 Binance API 请求，解决 GitHub Pages CORS 问题
 *   - 自动添加 CORS 响应头，允许任意域名访问
 *   - 支持 /price 接口获取多个交易对行情
 *   - 支持 /ping 接口健康检查
 * 
 * 部署方式：见 README 或项目文档
 */

// ============================================================
// 允许访问的来源（可改成你的 GitHub Pages 域名限制访问）
// ============================================================
const ALLOWED_ORIGIN = '*';  // 或改成 'https://willimas0521.github.io'

// Binance API 基础地址
const BINANCE_BASE = 'https://api.binance.com';

// ============================================================
// 主入口
// ============================================================
export default {
  async fetch(request, env, ctx) {
    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ---- 路由 ----
    if (path === '/ping') {
      return corsResponse(JSON.stringify({ ok: true, time: Date.now() }), 200);
    }

    if (path === '/price') {
      return handlePrice(url);
    }

    return corsResponse(JSON.stringify({ error: 'Not found', path }), 404);
  }
};

// ============================================================
// /price 处理器
// 参数: ?symbols=BTCUSDT,ETHUSDT,SOLUSDT,...
// ============================================================
async function handlePrice(url) {
  try {
    // 读取请求的交易对列表
    const symbolsParam = url.searchParams.get('symbols') || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,DOGEUSDT,XRPUSDT';
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    // 构造 Binance API 请求
    const symsJson = JSON.stringify(symbols);
    const binanceUrl = `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symsJson)}`;

    const resp = await fetch(binanceUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CFWorker/1.0)'
      },
      // Cloudflare Workers 请求超时
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return corsResponse(JSON.stringify({
        error: 'Binance API error',
        status: resp.status,
        detail: errText
      }), 502);
    }

    const data = await resp.json();
    return corsResponse(JSON.stringify(data), 200);

  } catch (e) {
    return corsResponse(JSON.stringify({
      error: 'Worker fetch failed',
      message: e.message
    }), 500);
  }
}

// ============================================================
// 辅助：构造带 CORS 头的响应
// ============================================================
function corsResponse(body, status) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache'
  };

  if (body === null) {
    return new Response(null, { status, headers });
  }

  return new Response(body, { status, headers });
}
