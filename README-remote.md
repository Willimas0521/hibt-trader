# HiBT Auto Trader - 远程访问配置说明

## 快速开始

### 方式一：直接运行（本地访问）
双击 `start.bat` → 自动打开浏览器访问 http://localhost:8888

### 方式二：远程访问（cpolar 内网穿透）

**第一步：注册 cpolar 账号**
1. 访问 https://dashboard.cpolar.com 注册免费账号
2. 登录后在「验证」页面复制你的 **authtoken**

**第二步：配置 authtoken（只需做一次）**
```
C:\cpolar\cpolar.exe authtoken <你的authtoken>
```

**第三步：双击 `start.bat`**
- 会同时启动本地服务器 + cpolar 穿透
- 打开 http://localhost:4040 即可看到公网访问地址（类似 `https://xxxx.cpolar.io`）
- 把这个地址分享给自己的手机或其他设备即可远程访问

---

## 手动操作

### 只启动本地服务器
```
node server.js
# 或指定端口
node server.js 8889
```

### 单独启动 cpolar（先确保服务器在运行）
```
C:\cpolar\cpolar.exe http 8888
```

---

## 端口说明

| 端口 | 用途 |
|------|------|
| 8888 | hibt-extension Web UI（本地） |
| 4040 | cpolar 管理界面（查看公网地址） |

---

## 注意事项

- **免费账号**：每次启动 cpolar 公网地址都会变（随机子域名）
- **付费账号**：可以固定子域名，如 `hibt.cpolar.io`
- API 请求（hibt.com/binance）由浏览器直接发出，与穿透地址无关
- 如果公网访问时行情请求失败，检查代理设置是否需要调整
