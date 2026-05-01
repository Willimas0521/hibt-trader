/**
 * Hibt 价格监控版 - Popup 脚本
 */

(function() {
  'use strict';

  // DOM 元素
  const currentPriceEl = document.getElementById('currentPrice');
  const priceChangeEl = document.getElementById('priceChange');
  const connStatusEl = document.getElementById('connStatus');
  const targetPriceInput = document.getElementById('targetPrice');
  const directionSelect = document.getElementById('direction');
  const tradeAmountInput = document.getElementById('tradeAmount');
  const tradeTimeframeSelect = document.getElementById('tradeTimeframe');
  const tradeActionSelect = document.getElementById('tradeAction');
  const btnAddAlert = document.getElementById('btnAddAlert');
  const btnClearAll = document.getElementById('btnClearAll');
  const alertsListEl = document.getElementById('alertsList');
  const logContainer = document.getElementById('logContainer');

  // WebSocket 连接
  let ws = null;
  let currentPrice = 0;
  let alerts = [];
  let isConnected = false;

  const WS_URL = 'ws://localhost:3001';

  // ===== 日志功能 =====
  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    let className = '';
    if (type === 'success') className = 'log-success';
    if (type === 'error') className = 'log-error';
    if (type === 'signal') className = 'log-signal';
    
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="${className}">${message}</span>`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    while (logContainer.children.length > 30) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  // ===== 更新价格显示 =====
  function updatePriceDisplay(data) {
    currentPrice = data.price;
    currentPriceEl.textContent = '$' + data.price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    const change = data.change24h;
    priceChangeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '% (24h)';
    priceChangeEl.className = 'price-change ' + (change >= 0 ? 'up' : 'down');
  }

  // ===== 更新连接状态 =====
  function updateConnectionStatus(connected) {
    isConnected = connected;
    if (connected) {
      connStatusEl.textContent = '● 已连接';
      connStatusEl.className = 'connection-status connected';
    } else {
      connStatusEl.textContent = '● 未连接';
      connStatusEl.className = 'connection-status disconnected';
    }
  }

  // ===== 渲染阈值列表 =====
  function renderAlerts() {
    if (alerts.length === 0) {
      alertsListEl.innerHTML = '<div class="empty-state">暂无价格监控</div>';
      return;
    }
    
    alertsListEl.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.triggered ? 'triggered' : ''}">
        <div class="alert-info">
          <div class="alert-price">
            ${alert.direction === 'above' ? '≥' : '≤'} $${alert.targetPrice.toLocaleString()}
            ${alert.triggered ? ' ✅已触发' : ''}
          </div>
          <div class="alert-detail">
            ${alert.action === 'sell' ? '📉 买跌' : '📈 买涨'} | 金额: ${alert.amount} USDT | 周期: ${alert.timeframe}分钟
          </div>
        </div>
        <div class="alert-actions">
          ${alert.triggered ? `<button class="btn-small btn-reset" data-id="${alert.id}" data-action="reset">重置</button>` : ''}
          <button class="btn-small btn-delete" data-id="${alert.id}" data-action="delete">删除</button>
        </div>
      </div>
    `).join('');
    
    // 绑定按钮事件
    alertsListEl.querySelectorAll('.btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        
        if (action === 'delete') {
          sendToServer({ type: 'remove_alert', id: id });
        } else if (action === 'reset') {
          sendToServer({ type: 'reset_alert', id: id });
        }
      });
    });
  }

  // ===== 连接 WebSocket =====
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  
  function connectWebSocket() {
    try {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        addLog('重连次数过多，请检查服务器是否启动', 'error');
        return;
      }
      
      reconnectAttempts++;
      addLog(`正在连接服务器... (尝试 ${reconnectAttempts})`);
      
      ws = new WebSocket(WS_URL);
      
      // 设置连接超时
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          addLog('连接超时', 'error');
        }
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        reconnectAttempts = 0;
        console.log('[Popup] WebSocket 已连接');
        updateConnectionStatus(true);
        addLog('已连接到价格服务器', 'success');
        
        // 请求当前状态
        sendToServer({ type: 'get_status' });
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.error('[Popup] 消息解析错误:', e);
        }
      };
      
      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        console.log('[Popup] WebSocket 已断开');
        updateConnectionStatus(false);
        addLog('与服务器断开，尝试重连...', 'error');
        setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('[Popup] WebSocket 错误:', error);
        // 不在这里显示错误，让 onclose 处理重连
      };
      
    } catch (error) {
      console.error('[Popup] 连接失败:', error);
      addLog('连接失败: ' + error.message, 'error');
      setTimeout(connectWebSocket, 5000);
    }
  }

  // ===== 处理服务器消息 =====
  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'price_update':
        updatePriceDisplay(msg.data);
        break;
        
      case 'alerts_list':
        alerts = msg.data || [];
        renderAlerts();
        break;
        
      case 'alert_added':
        alerts.push(msg.data);
        renderAlerts();
        addLog(`添加监控: ${msg.data.direction === 'above' ? '≥' : '≤'} $${msg.data.targetPrice}`, 'success');
        break;
        
      case 'alert_removed':
        alerts = alerts.filter(a => a.id !== msg.id);
        renderAlerts();
        addLog('删除监控', 'success');
        break;
        
      case 'alert_reset':
        const alert = alerts.find(a => a.id === msg.id);
        if (alert) alert.triggered = false;
        renderAlerts();
        addLog('重置监控', 'success');
        break;
        
      case 'alerts_cleared':
        alerts = [];
        renderAlerts();
        addLog('清空所有监控', 'success');
        break;
        
      case 'status':
        if (msg.data.currentPrice) {
          updatePriceDisplay(msg.data.currentPrice);
        }
        alerts = msg.data.alerts || [];
        renderAlerts();
        break;
        
      case 'price_trigger':
        const data = msg.data;
        addLog(`🚨 价格触发! $${data.triggerPrice.toLocaleString()} ${data.direction === 'above' ? '≥' : '≤'} $${data.targetPrice.toLocaleString()}`, 'signal');
        addLog('正在执行交易...', 'signal');
        
        // 触发交易
        executeTrade(data);
        
        // 更新列表显示
        const triggeredAlert = alerts.find(a => a.id === data.id);
        if (triggeredAlert) triggeredAlert.triggered = true;
        renderAlerts();
        break;
    }
  }

  // ===== 发送消息到服务器 =====
  function sendToServer(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      addLog('未连接到服务器', 'error');
    }
  }

  // ===== 执行交易 =====
  async function executeTrade(signalData) {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || !tab.url.includes('hibt.com')) {
        addLog('错误: 请先打开 hibt.com 交易页面', 'error');
        return;
      }
      
      // 注入脚本
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-price.js']
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log('[Popup] 脚本可能已注入:', e.message);
      }
      
      // 发送交易指令
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'execute_manual',
        data: {
          action: 'buy',
          amount: signalData.amount || 10,
          timeframe: signalData.timeframe || '60'
        }
      });
      
      if (response && response.success) {
        addLog('✅ 交易执行成功!', 'success');
      } else {
        addLog('❌ 交易执行失败: ' + (response?.error || '未知错误'), 'error');
      }
      
    } catch (error) {
      addLog('交易错误: ' + error.message, 'error');
    }
  }

  // ===== 事件绑定 =====
  
  // 添加价格监控
  btnAddAlert.addEventListener('click', () => {
    const targetPrice = parseFloat(targetPriceInput.value);
    const direction = directionSelect.value;
    const amount = parseInt(tradeAmountInput.value) || 10;
    const timeframe = tradeTimeframeSelect.value;
    const action = tradeActionSelect.value; // 'buy' 或 'sell'
    
    if (!targetPrice || targetPrice <= 0) {
      addLog('请输入有效的目标价格', 'error');
      return;
    }
    
    sendToServer({
      type: 'set_alert',
      targetPrice: targetPrice,
      direction: direction,
      amount: amount,
      timeframe: timeframe,
      action: action // 买涨或买跌
    });
    
    // 清空输入
    targetPriceInput.value = '';
  });
  
  // 清空所有
  btnClearAll.addEventListener('click', () => {
    if (confirm('确定要清空所有价格监控吗？')) {
      sendToServer({ type: 'clear_alerts' });
    }
  });

  // ===== 初始化 =====
  connectWebSocket();
  addLog('扩展已加载');
})();
