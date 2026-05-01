/**
 * Hibt 期权自动交易 - 内容脚本
 * 注入到 hibt.com 页面中执行
 */

(function() {
  'use strict';

  // 防止重复注入 - 如果已存在，先清理旧实例
  if (window.hibtAutoTrader) {
    console.log('[Hibt Auto] 扩展已存在，重新初始化...');
    // 停止旧的定时器
    if (window.hibtTrader && window.hibtTrader.stopAuto) {
      window.hibtTrader.stopAuto();
    }
  }
  window.hibtAutoTrader = true;

  console.log('[Hibt Auto] 扩展已加载 - ' + new Date().toLocaleTimeString());

  // ===== 工具函数 =====

  /**
   * 延迟等待
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 查找包含指定文字的元素
   */
  function findByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) {
        return el;
      }
    }
    return null;
  }

  /**
   * 查找所有包含指定文字的元素
   */
  function findAllByText(selector, text) {
    const result = [];
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) {
        result.push(el);
      }
    }
    return result;
  }

  /**
   * 模拟真实输入（绕过 React/Vue 框架限制）
   */
  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    valueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * 模拟真实点击
   */
  function simulateClick(element) {
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const mouseup = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
    
    element.dispatchEvent(mousedown);
    element.dispatchEvent(click);
    element.dispatchEvent(mouseup);
  }

  // ===== 核心操作函数 =====

  /**
   * 步骤 1：点击「60分钟」
   */
  async function selectTime60() {
    console.log('[Hibt Auto] 正在查找 60分钟 按钮...');
    
    // 尝试多种选择器
    const selectors = ['span', 'div', 'button', 'a'];
    for (const selector of selectors) {
      const btn = findByText(selector, '60分钟');
      if (btn) {
        console.log('[Hibt Auto] 找到 60分钟 按钮:', btn);
        simulateClick(btn);
        console.log('[Hibt Auto] ✅ 已点击 60分钟');
        return true;
      }
    }
    
    // 备用：通过 class 查找（根据常见框架类名）
    const timeButtons = document.querySelectorAll('[class*="time"], [class*="period"], [class*="interval"]');
    for (const btn of timeButtons) {
      if (btn.textContent.includes('60')) {
        simulateClick(btn);
        console.log('[Hibt Auto] ✅ 已点击 60分钟（通过 class）');
        return true;
      }
    }
    
    console.warn('[Hibt Auto] ❌ 未找到 60分钟 按钮');
    return false;
  }

  /**
   * 步骤 2：填写金额
   */
  async function setAmount(amount = 10) {
    console.log(`[Hibt Auto] 正在填写金额 ${amount}...`);
    
    // 策略 1：查找数字输入框
    let input = document.querySelector('input[type="number"]');
    
    // 策略 2：查找金额相关输入框
    if (!input) {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        const placeholder = inp.placeholder || '';
        const label = inp.getAttribute('aria-label') || '';
        if (placeholder.includes('金额') || label.includes('金额') || 
            placeholder.includes('amount') || placeholder.includes('Amount')) {
          input = inp;
          break;
        }
      }
    }
    
    // 策略 3：查找第一个非隐藏的文本输入框
    if (!input) {
      input = document.querySelector('input:not([type="hidden"]):not([type="password"])');
    }
    
    if (input) {
      input.focus();
      input.select();
      setNativeValue(input, amount.toString());
      console.log(`[Hibt Auto] ✅ 已填写金额 ${amount}`);
      return true;
    }
    
    console.warn('[Hibt Auto] ❌ 未找到金额输入框');
    return false;
  }

  /**
   * 步骤 3：点击「买涨」
   */
  async function clickBuyUp() {
    console.log('[Hibt Auto] 正在查找 买涨 按钮...');
    
    // 策略 1：通过文字查找
    const selectors = ['button', 'div', 'span', 'a'];
    for (const selector of selectors) {
      const btn = findByText(selector, '买涨');
      if (btn) {
        console.log('[Hibt Auto] 找到 买涨 按钮:', btn);
        simulateClick(btn);
        console.log('[Hibt Auto] ✅ 已点击 买涨');
        return true;
      }
    }
    
    // 策略 2：通过类名查找（绿色按钮通常是买涨）
    const buyUpClasses = [
      '[class*="buy-up"]',
      '[class*="buyUp"]',
      '[class*="rise"]',
      '[class*="up"]',
      '[class*="green"]',
      '[class*="long"]',
      '.btn-success',
      '.btn-primary'
    ];
    
    for (const classSelector of buyUpClasses) {
      const btn = document.querySelector(classSelector);
      if (btn && btn.textContent.includes('涨')) {
        simulateClick(btn);
        console.log('[Hibt Auto] ✅ 已点击 买涨（通过 class）');
        return true;
      }
    }
    
    console.warn('[Hibt Auto] ❌ 未找到 买涨 按钮');
    return false;
  }

  /**
   * 执行完整交易流程
   */
  async function executeTrade(options = {}) {
    const { time = 10, delay = 800 } = options;
    
    console.log('[Hibt Auto] ========== 开始执行交易 ==========');
    
    const results = {
      step1: false,
      step2: false,
      step3: false
    };
    
    // 步骤 1
    results.step1 = await selectTime60();
    await sleep(delay);
    
    // 步骤 2
    results.step2 = await setAmount(time);
    await sleep(delay);
    
    // 步骤 3
    results.step3 = await clickBuyUp();
    
    console.log('[Hibt Auto] ========== 执行结果 ==========');
    console.log('[Hibt Auto] 选择时间:', results.step1 ? '✅' : '❌');
    console.log('[Hibt Auto] 填写金额:', results.step2 ? '✅' : '❌');
    console.log('[Hibt Auto] 点击买涨:', results.step3 ? '✅' : '❌');
    
    return results;
  }

  // ===== 循环定时交易 =====
  
  let autoTradeInterval = null;

  function startAutoTrade(intervalMinutes = 5, amount = 10) {
    if (autoTradeInterval) {
      console.log('[Hibt Auto] 自动交易已在运行中');
      return;
    }
    
    console.log(`[Hibt Auto] 启动自动交易，间隔 ${intervalMinutes} 分钟，金额 ${amount}`);
    
    // 立即执行一次
    executeTrade({ amount });
    
    // 定时执行
    autoTradeInterval = setInterval(() => {
      console.log(`[Hibt Auto] 定时触发交易 ${new Date().toLocaleTimeString()}`);
      executeTrade({ amount });
    }, intervalMinutes * 60 * 1000);
  }

  function stopAutoTrade() {
    if (autoTradeInterval) {
      clearInterval(autoTradeInterval);
      autoTradeInterval = null;
      console.log('[Hibt Auto] 自动交易已停止');
    }
  }

  // ===== 监听来自 popup 的消息 =====
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Hibt Auto] 收到消息:', request);
    
    switch (request.action) {
      case 'execute':
        executeTrade({ amount: request.amount || 10 })
          .then(results => sendResponse({ success: true, results }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // 异步响应
        
      case 'startAuto':
        startAutoTrade(request.interval || 5, request.amount || 10);
        sendResponse({ success: true, message: '自动交易已启动' });
        break;
        
      case 'stopAuto':
        stopAutoTrade();
        sendResponse({ success: true, message: '自动交易已停止' });
        break;
        
      case 'getStatus':
        sendResponse({ 
          success: true, 
          running: !!autoTradeInterval,
          interval: autoTradeInterval ? '运行中' : '已停止'
        });
        break;
        
      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  });

  // 暴露到全局，方便控制台调试
  window.hibtTrader = {
    execute: executeTrade,
    startAuto: startAutoTrade,
    stopAuto: stopAutoTrade,
    selectTime60,
    setAmount,
    clickBuyUp
  };

  console.log('[Hibt Auto] 初始化完成，可用命令:');
  console.log('  hibtTrader.execute()      - 执行一次交易');
  console.log('  hibtTrader.startAuto(5)   - 每5分钟自动交易');
  console.log('  hibtTrader.stopAuto()     - 停止自动交易');

})();
