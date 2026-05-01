# Hibt + TradingView 自动交易

通过 TradingView Alert Webhook 触发 Hibt 期权交易

## 快速开始

### 1. 启动服务器

```powershell
cd C:\Users\Administrator\WorkBuddy\20260419154247\hibt-extension
node server.js
```

你会看到：
```
[WS] WebSocket 服务器运行在 ws://localhost:3001
[HTTP] Webhook 服务器运行在 http://localhost:3000
```

### 2. 配置扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 找到 Hibt 扩展，点击刷新按钮
3. 打开 https://hibt.com/zh-cn/options/BTC-USDT
4. 点击扩展图标，确认状态显示"等待 TradingView 信号..."

### 3. TradingView 设置

**免费版用户**：使用浏览器通知（见下方替代方案）

**付费版用户**：
1. 在 TradingView 图表上创建 Alert
2. Webhook URL: `http://localhost:3000/webhook`
3. Message:
```json
{"action":"buy","symbol":"{{ticker}}","amount":10,"timeframe":"60"}
```

### 4. 测试信号

在浏览器控制台执行：
```javascript
// 模拟 TradingView 信号
fetch('http://localhost:3000/webhook', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({action:'buy', amount:10, timeframe:'60'})
});
```

---

## 免费版 TradingView 替代方案

如果你没有 TradingView 付费会员，可以使用以下方法：

### 方案 A: 浏览器控制台脚本

在 TradingView 页面控制台粘贴：
```javascript
// 监听价格并发送信号
setInterval(() => {
  const price = document.querySelector('.tv-symbol-price-quote__value');
  if (price) {
    const p = parseFloat(price.textContent.replace(/,/g, ''));
    // 当价格达到条件时发送信号
    if (p > 85000) {  // 修改为你的条件
      fetch('http://localhost:3000/webhook', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action:'buy', amount:10, timeframe:'60'})
      });
    }
  }
}, 5000);
```

### 方案 B: 使用 Pine Script 浏览器通知

```pinescript
//@version=5
indicator("Hibt Signal", overlay=true)

// 你的交易条件
longCondition = ta.crossover(ta.sma(close, 14), ta.sma(close, 28))

if (longCondition)
    alert("BUY", alert.freq_once_per_bar)

plotshape(longCondition, "Buy", shape.triangleup, location.belowbar, color.green, size=size.small)
```

然后在 TradingView 设置 Alert：
- 条件：选择你的指标
- 消息：`BUY`
- 通知：勾选"显示弹出窗口"

当弹出窗口出现时，手动点击扩展的"一键买涨"按钮。

---

## 信号格式

```json
{
  "action": "buy",        // buy=买涨, sell=买跌
  "symbol": "BTCUSDT",    // 交易对
  "amount": 10,           // 金额
  "timeframe": "60"       // 时间周期: 1,5,15,30,60
}
```

---

## 故障排查

### 扩展显示"未连接"
1. 确认 server.js 已启动
2. 刷新 hibt.com 页面
3. 重新打开扩展 popup

### 信号发送成功但交易未执行
1. 检查浏览器控制台是否有错误
2. 确认 hibt.com 页面已完全加载
3. 检查扩展 popup 中的日志

### 端口被占用
修改 server.js 中的端口号：
```javascript
const HTTP_PORT = 3000;  // 改为其他端口如 8080
const WS_PORT = 3001;    // 改为其他端口如 8081
```

---

## 文件说明

- `server.js` - Webhook 接收服务器
- `content-tradingview.js` - 页面内交易执行脚本
- `popup-tv.html/js` - 扩展弹出界面
- `manifest.json` - 扩展配置
