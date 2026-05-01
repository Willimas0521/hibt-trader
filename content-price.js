/**
 * Hibt 价格监控版 - 内容脚本
 * 接收价格触发信号并执行交易
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.hibtPriceTrader) {
    console.log('[Hibt Price] 重新初始化...');
  }
  window.hibtPriceTrader = true;

  console.log('[Hibt Price] 价格监控交易助手已加载');

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
    console.log(`[Hibt Price] 选择时间周期: ${timeframe}分钟`);
    
    const timeMap = {
      '5': '5分钟',
      '10': '10分钟',
      '15': '15分钟',
      '30': '30分钟',
      '60': '60分钟'
    };
    
    const text = timeMap[timeframe] || `${timeframe}分钟`;
    
    // 先尝试查找时间选择区域的按钮
    const timeButtons = document.querySelectorAll('button, div[role="button"], span');
    for (const btn of timeButtons) {
      const btnText = btn.textContent?.trim();
      if (btnText === text || btnText === `${timeframe}分钟`) {
        simulateClick(btn);
        console.log(`[Hibt Price] ✅ 已选择 ${text}`);
        return true;
      }
    }
    
    // 备用方案：通用查找
    const selectors = ['button', 'div', 'span'];
    for (const selector of selectors) {
      const btn = findByText(selector, text);
      if (btn) {
        simulateClick(btn);
        console.log(`[Hibt Price] ✅ 已选择 ${text}`);
        return true;
      }
    }
    console.warn(`[Hibt Price] ❌ 未找到 ${text} 按钮`);
    return false;
  }

  async function setAmount(amount) {
    console.log(`[Hibt Price] 填写金额: ${amount}`);
    
    // 尝试多种方式查找金额输入框
    let input = document.querySelector('input[type="number"]');
    
    // 查找包含金额相关文本的输入框
    if (!input) {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        const placeholder = inp.placeholder || '';
        const ariaLabel = inp.getAttribute('aria-label') || '';
        const name = inp.name || '';
        if (placeholder.includes('金额') || placeholder.includes('amount') || 
            placeholder.includes('Amount') || ariaLabel.includes('金额') ||
            name.includes('amount') || name.includes('money')) {
          input = inp;
          break;
        }
      }
    }
    
    // 查找交易区域的输入框
    if (!input) {
      // 尝试找到交易表单区域的输入框
      const tradeSections = document.querySelectorAll('[class*="trade"], [class*="order"], [class*="buy"]');
      for (const section of tradeSections) {
        const inp = section.querySelector('input');
        if (inp) {
          input = inp;
          break;
        }
      }
    }
    
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      input.focus();
      input.select();
      setNativeValue(input, amount.toString());
      console.log(`[Hibt Price] ✅ 已填写金额 ${amount}`);
      return true;
    }
    console.warn('[Hibt Price] ❌ 未找到金额输入框');
    return false;
  }

  async function clickBuyUp() {
    console.log('[Hibt Price] 点击买涨...');
    
    // 尝试多种方式查找买涨按钮
    // 1. 通过文本内容查找
    const allButtons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
    for (const btn of allButtons) {
      const text = btn.textContent?.trim();
      if (text === '买涨' || text === '看涨' || text === '买入' || text.includes('买涨')) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买涨:', text);
        return true;
      }
    }
    
    // 2. 通过类名查找（常见的买涨按钮类名）
    const buySelectors = [
      '[class*="buy"]',
      '[class*="up"]',
      '[class*="long"]',
      '[class*="bull"]'
    ];
    for (const sel of buySelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买涨 (通过类名)');
        return true;
      }
    }
    
    // 3. 备用方案：通用查找
    const selectors = ['button', 'div', 'span'];
    for (const selector of selectors) {
      const btn = findByText(selector, '买涨');
      if (btn) {
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买涨');
        return true;
      }
    }
    console.warn('[Hibt Price] ❌ 未找到买涨按钮');
    return false;
  }

  async function clickBuyDown() {
    console.log('[Hibt Price] 点击买跌...');
    
    // 尝试多种方式查找买跌按钮
    // 1. 通过文本内容查找
    const allButtons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
    for (const btn of allButtons) {
      const text = btn.textContent?.trim();
      if (text === '买跌' || text === '看跌' || text === '卖出' || text.includes('买跌')) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买跌:', text);
        return true;
      }
    }
    
    // 2. 通过类名查找（常见的买跌按钮类名）
    const sellSelectors = [
      '[class*="sell"]',
      '[class*="down"]',
      '[class*="short"]',
      '[class*="bear"]'
    ];
    for (const sel of sellSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买跌 (通过类名)');
        return true;
      }
    }
    
    // 3. 备用方案：通用查找
    const selectors = ['button', 'div', 'span'];
    for (const selector of selectors) {
      const btn = findByText(selector, '买跌');
      if (btn) {
        simulateClick(btn);
        console.log('[Hibt Price] ✅ 已点击买跌');
        return true;
      }
    }
    console.warn('[Hibt Price] ❌ 未找到买跌按钮');
    return false;
  }

  // ===== 执行交易 =====
  
  async function executeTrade(signal) {
    if (isExecuting) {
      console.log('[Hibt Price] 已有交易在执行中');
      return { success: false, error: '交易执行中' };
    }
    
    isExecuting = true;
    console.log('[Hibt Price] ========== 开始执行交易 ==========');
    console.log('[Hibt Price] 信号:', signal);
    
    try {
      const { amount, timeframe, action } = signal;
      const tradeAmount = amount || 10;
      const tradeTimeframe = timeframe || '60';
      const tradeAction = action || 'buy'; // 'buy' 买涨 或 'sell' 买跌
      
      // 步骤 1: 选择时间周期
      await selectTimeframe(tradeTimeframe);
      await sleep(600);
      
      // 步骤 2: 填写金额
      await setAmount(tradeAmount);
      await sleep(600);
      
      // 步骤 3: 根据操作类型点击买涨或买跌
      let result;
      if (tradeAction === 'sell') {
        result = await clickBuyDown();
      } else {
        result = await clickBuyUp();
      }
      
      console.log('[Hibt Price] ========== 交易执行完成 ==========');
      
      return { success: result };
      
    } catch (error) {
      console.error('[Hibt Price] 执行错误:', error);
      return { success: false, error: error.message };
    } finally {
      isExecuting = false;
    }
  }

  // ===== WebSocket 连接价格服务器 =====
  let ws = null;
  let wsConnected = false;
  let autoTradeEnabled = true; // 自动交易开关
  let wsPort = 3001; // 默认端口，会尝试其他端口
  
  function tryConnectWebSocket(port) {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${port}`;
      console.log('[Hibt Price] 尝试连接:', wsUrl);
      
      const socket = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('连接超时'));
      }, 3000);
      
      socket.onopen = () => {
        clearTimeout(timeout);
        console.log('[Hibt Price] ✅ 已连接到价格服务器，端口:', port);
        wsConnected = true;
        wsPort = port;
        ws = socket;
        resolve(socket);
      };
      
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('连接失败'));
      };
    });
  }
  
  async function connectPriceServer() {
    // 尝试端口 3001-3005
    for (let port = 3001; port <= 3005; port++) {
      try {
        await tryConnectWebSocket(port);
        setupWebSocketHandlers();
        return;
      } catch (e) {
        console.log(`[Hibt Price] 端口 ${port} 连接失败`);
      }
    }
    
    console.error('[Hibt Price] 所有端口都无法连接，5秒后重试...');
    setTimeout(connectPriceServer, 5000);
  }
  
  function setupWebSocketHandlers() {
    if (!ws) return;
    
    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[Hibt Price] 收到服务器消息:', message.type, message);
        
          // 价格触发信号 - 自动执行交易
          if (message.type === 'price_trigger' && autoTradeEnabled) {
            console.log('[Hibt Price] 🚨 价格阈值触发，准备自动下单!');
            console.log('[Hibt Price] 触发数据:', message.data);
            
            // 执行自动交易
            const result = await executeTrade({
              amount: message.data.amount || 10,
              timeframe: message.data.timeframe || '60',
              action: message.data.action || 'buy' // 'buy' 或 'sell'
            });
            
            if (result.success) {
              console.log('[Hibt Price] ✅ 自动下单成功!');
            } else {
              console.error('[Hibt Price] ❌ 自动下单失败:', result.error);
            }
          }
        
        // 价格更新
        if (message.type === 'price_update') {
          window.hibtPrice.currentPrice = message.data;
        }
        
      } catch (e) {
        console.error('[Hibt Price] 消息解析错误:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('[Hibt Price] 与价格服务器断开，5秒后重连...');
      wsConnected = false;
      setTimeout(connectPriceServer, 5000);
    };
    
    ws.onerror = (err) => {
      console.error('[Hibt Price] WebSocket 错误:', err);
    };
  }
  
  // 启动连接
  connectPriceServer();
  
  // ===== 监听来自 popup 的消息 =====
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Hibt Price] 收到消息:', request);
    
    switch (request.action) {
      case 'execute_manual':
        executeTrade(request.data)
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
        
      case 'toggle_auto_trade':
        autoTradeEnabled = request.enabled;
        console.log('[Hibt Price] 自动交易:', autoTradeEnabled ? '开启' : '关闭');
        sendResponse({ success: true, autoTradeEnabled });
        return true;
        
      case 'get_status':
        sendResponse({
          wsConnected,
          autoTradeEnabled,
          executing: isExecuting,
          currentPrice: window.hibtPrice?.currentPrice
        });
        return true;
        
      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  });

  // ===== 暴露到全局 =====
  
  window.hibtPrice = {
    execute: executeTrade,
    status: () => ({ 
      executing: isExecuting,
      wsConnected,
      autoTradeEnabled,
      currentPrice: window.hibtPrice?.currentPrice
    }),
    toggleAuto: (enabled) => { autoTradeEnabled = enabled; },
    reconnect: connectPriceServer
  };

  console.log('[Hibt Price] 可用命令:');
  console.log('  hibtPrice.execute({amount:10,timeframe:"60"})');

})();
