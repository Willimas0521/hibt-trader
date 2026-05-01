/**
 * Hibt TradingView 信号版 - Popup 脚本
 */

(function() {
  'use strict';

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const amountInput = document.getElementById('amountInput');
  const timeSelect = document.getElementById('timeSelect');
  const btnExecute = document.getElementById('btnExecute');
  const logContainer = document.getElementById('logContainer');

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
    if (type === 'signal') className = 'log-success';
    
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="${className}">${message}</span>`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    while (logContainer.children.length > 20) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  // ===== 状态更新 =====
  function updateStatus(connected, executing) {
    if (executing) {
      statusDot.classList.add('running');
      statusText.textContent = '执行交易中...';
    } else if (connected) {
      statusDot.classList.add('running');
      statusText.textContent = '✅ 已连接 TradingView';
    } else {
      statusDot.classList.remove('running');
      statusText.textContent = '⏳ 等待 TradingView 信号...';
    }
  }

  // ===== 发送消息到内容脚本 =====
  async function sendToContent(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('未找到活动标签页');
      if (!tab.url || !tab.url.includes('hibt.com')) {
        throw new Error('请先打开 hibt.com 交易页面');
      }
      
      // 注入脚本
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-tradingview.js']
        });
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {}
      
      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // ===== 手动执行交易 =====
  btnExecute.addEventListener('click', async () => {
    const amount = parseInt(amountInput.value) || 10;
    const timeframe = timeSelect.value;
    
    btnExecute.disabled = true;
    addLog(`手动执行: ${timeframe}分钟, ${amount} USDT`);
    
    try {
      const result = await sendToContent({
        action: 'execute_manual',
        data: { action: 'buy', amount: amount, timeframe: timeframe }
      });
      
      if (result.success) {
        addLog('✅ 交易执行成功', 'success');
      } else {
        addLog(`❌ ${result.error || '执行失败'}`, 'error');
      }
    } catch (error) {
      addLog(`错误: ${error.message}`, 'error');
    }
    
    btnExecute.disabled = false;
  });

  // ===== 检查连接状态 =====
  async function checkStatus() {
    try {
      const result = await sendToContent({ action: 'get_status' });
      if (result.success) {
        updateStatus(result.connected, result.executing);
      }
    } catch (e) {
      updateStatus(false, false);
    }
  }

  // ===== 初始化 =====
  chrome.storage.local.get(['amount', 'timeframe'], (result) => {
    if (result.amount) amountInput.value = result.amount;
    if (result.timeframe) timeSelect.value = result.timeframe;
  });

  amountInput.addEventListener('change', () => {
    chrome.storage.local.set({ amount: amountInput.value });
  });
  
  timeSelect.addEventListener('change', () => {
    chrome.storage.local.set({ timeframe: timeSelect.value });
  });

  checkStatus();
  setInterval(checkStatus, 3000);

  addLog('扩展已加载，等待信号...');
})();
