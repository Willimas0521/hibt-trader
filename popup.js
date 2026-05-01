/**
 * Hibt 自动交易扩展 - Popup 脚本
 */

(function() {
  'use strict';

  // DOM 元素
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const amountInput = document.getElementById('amountInput');
  const timeSelect = document.getElementById('timeSelect');
  const btnExecute = document.getElementById('btnExecute');
  const logContainer = document.getElementById('logContainer');

  // ===== 日志功能 =====
  
  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    let className = '';
    if (type === 'success') className = 'log-success';
    if (type === 'error') className = 'log-error';
    
    entry.innerHTML = `
      <span class="log-time">${time}</span> 
      <span class="${className}">${message}</span>
    `;
    
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // 限制日志条数
    while (logContainer.children.length > 20) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  // ===== 状态更新 =====
  
  function updateStatus(executing) {
    if (executing) {
      statusDot.classList.add('running');
      statusText.textContent = '执行中...';
      btnExecute.disabled = true;
    } else {
      statusDot.classList.remove('running');
      statusText.textContent = '等待信号...';
      btnExecute.disabled = false;
    }
  }

  // ===== 发送消息到内容脚本 =====
  
  async function sendToContent(message) {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      if (!tab) {
        throw new Error('未找到活动标签页');
      }
      
      // 检查是否是 hibt.com
      if (!tab.url || (!tab.url.includes('hibt.com') && !tab.url.includes('hibt'))) {
        throw new Error('请先打开 hibt.com 交易页面');
      }
      
      // 先尝试注入脚本（解决首次加载或页面刷新后连接不存在的问题）
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // 给脚本一点初始化时间
        await new Promise(r => setTimeout(r, 300));
      } catch (injectError) {
        // 脚本可能已存在，忽略错误
      }
      
      // 发送消息
      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response;
      
    } catch (error) {
      throw error;
    }
  }

  // ===== 事件处理 =====

  // 立即执行一次
  btnExecute.addEventListener('click', async () => {
    const amount = parseInt(amountInput.value) || 10;
    
    btnExecute.disabled = true;
    btnExecute.textContent = '执行中...';
    addLog(`开始执行交易，金额: ${amount} USDT`);
    
    try {
      const result = await sendToContent({ 
        action: 'execute', 
        amount: amount 
      });
      
      if (result.success) {
        const { step1, step2, step3 } = result.results;
        addLog(`步骤1(60分钟): ${step1 ? '✅' : '❌'}`, step1 ? 'success' : 'error');
        addLog(`步骤2(金额): ${step2 ? '✅' : '❌'}`, step2 ? 'success' : 'error');
        addLog(`步骤3(买涨): ${step3 ? '✅' : '❌'}`, step3 ? 'success' : 'error');
        addLog('交易执行完成', 'success');
      } else {
        addLog(`执行失败: ${result.error}`, 'error');
      }
      
    } catch (error) {
      addLog(`错误: ${error.message}`, 'error');
    }
    
    btnExecute.disabled = false;
    btnExecute.textContent = '立即执行一次';
  });

  // 开始自动交易
  btnStartAuto.addEventListener('click', async () => {
    const amount = parseInt(amountInput.value) || 10;
    const interval = parseInt(intervalInput.value) || 5;
    
    addLog(`启动自动交易，间隔: ${interval}分钟，金额: ${amount} USDT`);
    
    try {
      const result = await sendToContent({ 
        action: 'startAuto',
        amount: amount,
        interval: interval
      });
      
      if (result.success) {
        updateStatus(true);
        addLog('自动交易已启动', 'success');
      } else {
        addLog(`启动失败: ${result.error}`, 'error');
      }
      
    } catch (error) {
      addLog(`错误: ${error.message}`, 'error');
    }
  });

  // 停止自动交易
  btnStopAuto.addEventListener('click', async () => {
    addLog('正在停止自动交易...');
    
    try {
      const result = await sendToContent({ action: 'stopAuto' });
      
      if (result.success) {
        updateStatus(false);
        addLog('自动交易已停止', 'success');
      }
      
    } catch (error) {
      addLog(`错误: ${error.message}`, 'error');
    }
  });

  // ===== 初始化 =====
  
  // 加载保存的设置
  chrome.storage.local.get(['amount', 'interval'], (result) => {
    if (result.amount) amountInput.value = result.amount;
    if (result.interval) intervalInput.value = result.interval;
  });

  // 保存设置
  amountInput.addEventListener('change', () => {
    chrome.storage.local.set({ amount: amountInput.value });
  });
  
  intervalInput.addEventListener('change', () => {
    chrome.storage.local.set({ interval: intervalInput.value });
  });

  // 检查当前状态
  sendToContent({ action: 'getStatus' })
    .then(result => {
      if (result.success) {
        updateStatus(result.running);
      }
    })
    .catch(() => {
      // 忽略错误，可能页面未加载
    });

  addLog('扩展已加载');
})();
