# Hibt + TradingView 内网穿透配置指南

## 快速启动（推荐）

### 第一步：获取 ngrok Token（只需一次）

1. 访问 https://dashboard.ngrok.com/signup 注册账号
2. 登录后访问 https://dashboard.ngrok.com/get-started/your-authtoken
3. 复制你的 authtoken
4. 在 PowerShell 中运行：
   ```powershell
   cd C:\Users\Administrator\WorkBuddy\20260419154247\hibt-extension
   npx ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

### 第二步：一键启动

```powershell
cd C:\Users\Administrator\WorkBuddy\20260419154247\hibt-extension
node start-with-ngrok.js
```

或者双击运行：`start-simple.bat`

### 第三步：配置 TradingView

启动成功后，控制台会显示：
```
🌐 公网访问地址:
   https://xxxx.ngrok-free.app/webhook
```

在 TradingView Alert 中：
- **Webhook URL**: `https://xxxx.ngrok-free.app/webhook`
- **消息**: `{"action":"buy","amount":10,"timeframe":"60"}`

---

## 手动启动（分步）

如果一键启动有问题，可以手动分步运行：

### 窗口 1：启动服务器
```powershell
cd C:\Users\Administrator\WorkBuddy\20260419154247\hibt-extension
node server.js
```

### 窗口 2：启动 ngrok
```powershell
cd C:\Users\Administrator\WorkBuddy\20260419154247\hibt-extension
npx ngrok http 3000
```

ngrok 会显示：
```
Forwarding  https://xxxx.ngrok-free.app -> http://localhost:3000
```

使用 `https://xxxx.ngrok-free.app/webhook` 作为 TradingView Webhook URL。

---

## TradingView Alert 配置示例

### 买入信号（买涨）
```json
{"action":"buy","symbol":"{{ticker}}","amount":10,"timeframe":"60"}
```

### 卖出信号（买跌）
```json
{"action":"sell","symbol":"{{ticker}}","amount":10,"timeframe":"60"}
```

### 使用 TradingView 变量
```json
{"action":"buy","symbol":"{{ticker}}","price":{{close}},"time":"{{time}}"}
```

可用变量：
- `{{ticker}}` - 交易对代码
- `{{close}}` - 收盘价
- `{{open}}` - 开盘价
- `{{high}}` - 最高价
- `{{low}}` - 最低价
- `{{volume}}` - 成交量
- `{{time}}` - 时间

---

## 常见问题

### Q: ngrok URL 每次都会变？
**A:** 免费版 ngrok 每次启动 URL 都会变化。需要：
1. 每次启动后复制新的 URL
2. 更新 TradingView Alert 的 Webhook URL

或者购买 ngrok 付费版使用固定域名。

### Q: 如何保持长期运行？
**A:** 
- 免费版 ngrok 有连接时间限制（约 2 小时）
- 需要定期重启
- 建议只在交易时段开启

### Q: 可以同时在多个 TradingView 图表使用吗？
**A:** 可以，同一个 Webhook URL 可以接收多个 Alert。

### Q: 如何测试是否配置成功？
**A:** 
1. 启动服务器和 ngrok
2. 浏览器访问：`https://你的ngrok地址/webhook`
3. 应该看到：`{"success":false,"error":"Not found"}`（这是正常的，因为需要 POST 请求）
4. 在 TradingView 点击 Alert 的「测试」按钮

---

## 安全提示

⚠️ **重要**：
1. 不要把 ngrok URL 分享给他人
2. 免费版 ngrok URL 是公开的，任何人知道 URL 都可以发送请求
3. 建议只在交易时段开启，不使用时关闭
4. 可以考虑在 `server.js` 中添加简单的 Token 验证

---

## 下一步

配置完成后：
1. 打开 Chrome 扩展
2. 打开 hibt.com 并登录
3. 在 TradingView 创建 Alert
4. 等待信号触发，自动执行交易！
