/**
 * HiBT Trader 本地代理服务
 *
 * 用法: node proxy-server.js
 *
 * 功能:
 *   - 启动在 localhost:3456
 *   - 所有海外API请求通过本地代理(127.0.0.1:7890)转发
 *   - 浏览器打开 http://localhost:3456 即可使用完整功能
 *   - 同时提供 /api/* 代理路由供 hibt-trader 调用
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3456;
const PROXY = 'http://127.0.0.1:7890'; // Clash 代理

// 目标 API 映射
const ROUTES = {
    '/api/price': { target: 'https://api.binance.com/api/v3/ticker/24hr', method: 'GET' },
    '/api/hibt':  { target: 'https://api.hibt.com',                         method: 'PASS' }, // 透传
};

// ============================================================
//  静态文件服务 (托管 index.html)
// ============================================================
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(__dirname, filePath);

    // 安全检查：不允许路径穿越
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

// ============================================================
//  通过代理发送 HTTPS 请求
// ============================================================
function proxyFetch(targetUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(targetUrl);

        // 构造通过代理的 HTTP CONNECT 或直接请求
        // 这里用简单方式：构造完整的代理请求

        const proxyOpts = {
            host: '127.0.0.1',
            port: 7890,
            path: targetUrl,
            method: options.method || 'GET',
            headers: Object.assign({
                'Host': parsed.host,
                'User-Agent': 'HiBT-Proxy/1.0',
                'Accept': 'application/json',
            }, options.headers || {}),
        };

        if (options.body && options.method !== 'GET') {
            // body 需要作为 Buffer 传递
        }

        const req = http.request(proxyOpts, (proxyRes) => {
            let data = [];
            proxyRes.on('data', chunk => data.push(chunk));
            proxyRes.on('end', () => {
                resolve({
                    status: proxyRes.statusCode,
                    headers: proxyRes.headers,
                    body: Buffer.concat(data),
                });
            });
        });

        req.on('error', reject);

        if (options.body && options.method !== 'GET') {
            if (typeof options.body === 'string') {
                req.write(options.body);
            } else {
                req.write(JSON.stringify(options.body));
            }
        }
        req.end();
    });
}

// ============================================================
//  路由处理
// ============================================================
async function handleApiPrice(req, res) {
    try {
        const result = await proxyFetch(
            `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT']))}`,
            { method: 'GET', headers: { 'Accept': 'application/json' } }
        );
        res.writeHead(result.status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
        });
        res.end(result.body.toString());
    } catch(e) {
        console.error('[price]', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}

async function handleApiHibt(req, res) {
    // 透传到 api.hibt.com，保留原始方法/头/body
    try {
        let body = [];
        await new Promise((resolve) => {
            req.on('data', chunk => body.push(chunk));
            req.on('end', resolve);
        });
        const bodyStr = Buffer.concat(body).toString();

        // 提取目标路径: /api/hibt/api/v1/order -> /api/v1/order
        const targetPath = req.url.replace(/^\/api\/hibt/, '') || '/';
        const targetUrl = `https://api.hibt.com${targetPath}${req.url.includes('?') ? '?' + new URL(req.url, 'http://localhost').search : ''}`;

        // 收集需要转发的请求头
        const forwardHeaders = {};
        if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];
        if (req.headers['authorization']) forwardHeaders['Authorization'] = req.headers['authorization'];
        forwardHeaders['Host'] = 'api.hibt.com';
        forwardHeaders['User-Agent'] = 'HiBT-Proxy/1.0';

        const result = await proxyFetch(targetUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: bodyStr || undefined,
        });

        res.writeHead(result.status, {
            'Content-Type': result.headers['content-type'] || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Cache-Control': 'no-cache',
        });
        res.end(result.body);
    } catch(e) {
        console.error('[hibt]', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
    }
}

function handleOptions(req, res) {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
}

// ============================================================
//  主服务器
// ============================================================
const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') { handleOptions(req, res); return; }

    // API 路由
    if (pathname === '/api/price') { await handleApiPrice(req, res); return; }
    if (pathname.startsWith('/api/hibt')) { await handleApiHibt(req, res); return; }

    // 健康检查
    if (pathname === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, time: Date.now() }));
        return;
    }

    // 默认：静态文件
    serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ========================================');
    console.log('  🚀 HiBT Trader 本地代理服务已启动');
    console.log('  ========================================');
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  代理: ${PROXY}`);
    console.log(`  行情: http://localhost:${PORT}/api/price`);
    console.log(`  HiBT: http://localhost:${PORT}/api/hibt/...`);
    console.log('');
    console.log('  请在浏览器打开上面的地址');
    console.log('  按 Ctrl+C 停止');
    console.log('  ========================================');
    console.log('');
});
