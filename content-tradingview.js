/**
 * Hibt 期权自动交易 - TradingView 信号版
 * 
 * 功能：
 *   1. 连接本地 WebSocket 服务器接收 TradingView 信号
 *   2. 收到信号后自动执行交易
 *   3. 支持手动一键交易
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.hibtTradingViewTrader) {
    console.log('[Hibt TV] 重新连接...');
    if (window.hibtTVSocket) {
      window.hibtTVSocket.close();
    }
  }
  window.hibtTradingViewTrader = true;

  // ===== 配置 =====
  const WS_URL = 'ws://localhost:3001';
  const RECONNECT_INTERVAL = 5000;

  let ws = null;
  let reconnectTimer = null;
  let isExecuting = false;

  // ===== 工具函数 =====
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function findByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) {
        return el;
      }
    }
    return null;
  }

  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    valueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function simulateClick(element) {
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    element.dispatchEvent(mousedown);
    element.dispatchEvent(click);
    element.dispatchEvent(mouseup);
  }

  // ===== 交易执行函数 =====
  
  async function selectTimeframe(timeframe) {
    console.log(`[Hibt TV] 选择时间周期: ${timeframe}分钟`);
    
    const timeMap = {
      '1': '1分钟',
      '5': '5分钟', 
      '15': '15分钟',
      '30': '30分钟',
      '60': '60分钟'
    };
    
    const text = timeMap[timeframe] || `${timeframe}分钟`;
    
    const selectors = ['span', 'div', 'button'];
    for (const selector of selectors) {
      const btn = findByText(selector, text);
      if (btn) {
        simulateClick(btn);
        console.log(`[Hibt TV] ✅ 已选择 ${text}`);
        return true;
      }
    }
    console.warn(`[Hibt TV] ❌ 未找到 ${text} 按钮`);
    return false;
  }

  async function setAmount(amount) {
    console.log(`[Hibt TV] 填写金额: ${amount}`);
    
    let input = document.querySelector('input[type="number"]');
    
    if (!input) {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        const placeholder = inp.placeholder || '';
        if (placeholder.includes('金额') || placeholder.includes('amount')) {
          input = inp;
          break;
        }
      }
    }
    
    if (input) {
      input.focus();
      input.select();
      setNativeValue(input, amount.toString());
      console.log(`[Hibt TV] ✅ 已填写金额 ${amount}`);
      return true;
    }
    console.warn('[Hibt TV] ❌ 未找到金额输入框');
    return false;
  }

  async function clickBuyUp() {
    console.log('[Hibt TV] 点击买涨...');
    
    const selectors = ['button', 'div', 'span'];
    for (const selector of selectors) {
      const btn = findByText(selector, '买涨');
      if (btn) {
        simulateClick(btn);
        console.log('[Hibt TV] ✅ 已点击买涨');
        return true;
      }
    }
    console.warn('[Hibt TV] ❌ 未找到买涨按钮');
    return false;
  }

  async function clickBuyDown() {
    console.log('[Hibt TV] 点击买跌...');
    
    const selectors = ['button', 'div', 'span'];
    for (const selector of selectors) {
      const btn = findByText(selector, '买跌');
      if (btn) {
        simulateClick(btn);
        console.log('[Hibt TV] ✅ 已点击买跌');
        return true;
      }
    }
    console.warn('[Hibt TV] ❌ 未找到买跌按钮');
    return false;
  }

  // ===== 执行交易 =====
  
  async function executeTrade(signal) {
    if (isExecuting) {
      console.log('[Hibt TV] 已有交易在执行中，忽略新信号');
      return { success: false, error: '交易执行中' };
    }
    
    isExecuting = true;
    console.log('[Hibt TV] ========== 开始执行交易 ==========');
    console.log('[Hibt TV] 信号:', signal);
    
    try {
      const { action, amount, timeframe } = signal;
      const tradeAmount = amount || 10;
      const tradeTimeframe = timeframe || '60';
      
      // 步骤 1: 选择时间周期
      await selectTimeframe(tradeTimeframe);
      await sleep(500);
      
      // 步骤 2: 填写金额
      await setAmount(tradeAmount);
      await sleep(500);
      
      // 步骤 3: 根据信号方向点击
      let result = false;
      if (action === 'buy' || action === 'long') {
        result = await clickBuyUp();
      } else if (action === 'sell' || action === 'short') {
        result = await clickBuyDown();
      } else {
        // 默认买涨
        result = await clickBuyUp();
      }
      
      console.log('[Hibt TV] ========== 交易执行完成 ==========');
      
      // 发送执行结果回服务器
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'trade_result',
          signal: signal,
          success: result,
          timestamp: new Date().toISOString()
        }));
      }
      
      return { success: result };
      
    } catch (error) {
      console.error('[Hibt TV] 执行错误:', error);
      return { success: false, error: error.message };
    } finally {
      isExecuting = false;
    }
  }

  // ===== WebSocket 连接 =====
  
  function connectWebSocket() {
    console.log(`[Hibt TV] 正在连接 WebSocket: ${WS_URL}`);
    
    try {
      ws = new WebSocket(WS_URL);
      window.hibtTVSocket = ws;
      
      ws.onopen = () => {
        console.log('[Hibt TV] ✅ WebSocket 已连接');
        showNotification('TradingView 信号连接成功', '等待交易信号...');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[Hibt TV] 收到消息:', message);
          
          if (message.type === 'tradingview_signal') {
            showNotification('📊 收到 TradingView 信号', 
              `${message.data.action?.toUpperCase()} ${message.data.symbol || ''}`);
            executeTrade(message.data);
          }
          
        } catch (error) {
          console.error('[Hibt TV] 消息解析错误:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('[Hibt TV] WebSocket 已断开，尝试重连...');
        showNotification('信号连接断开', '正在重新连接...');
        reconnectTimer = setTimeout(connectWebSocket, RECONNECT_INTERVAL);
      };
      
      ws.onerror = (error) => {
        console.error('[Hibt TV] WebSocket 错误:', error);
      };
      
    } catch (error) {
      console.error('[Hibt TV] 连接失败:', error);
      reconnectTimer = setTimeout(connectWebSocket, RECONNECT_INTERVAL);
    }
  }

  // ===== 桌面通知 =====
  
  function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon48.svg' });
    }
  }

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // ===== 启动连接 =====
  
  connectWebSocket();

  // ===== 监听来自 popup 的消息 =====
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Hibt TV] 收到消息:', request);
    
    switch (request.action) {
      case 'execute_manual':
        executeTrade(request.data)
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
        
      case 'get_status':
        sendResponse({
          success: true,
          connected: ws?.readyState === WebSocket.OPEN,
          executing: isExecuting
        });
        break;
        
      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  });

  // ===== 暴露到全局 =====
  
  window.hibtTV = {
    execute: executeTrade,
    connect: connectWebSocket,
    disconnect: () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
    status: () => ({
      connected: ws?.readyState === WebSocket.OPEN,
      executing: isExecuting
    })
  };

  console.log('[Hibt TV] TradingView 交易助手已加载');
  console.log('[Hibt TV] 可用命令:');
  console.log('  hibtTV.execute({action:"buy",amount:10,timeframe:"60"})');
  console.log('  hibtTV.status()');
  console.log('  hibtTV.disconnect()');

})();
