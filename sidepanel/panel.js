/**
 * AI Roundtable - Side Panel Controller
 * 
 * Original Author: Axton Liu (MIT License)
 * Modifications by: Wei Topaz (2026)
 * 
 * See MODIFICATIONS.md for detailed change log.
 * 
 * This is the main entry point that coordinates all modules.
 */

// Import modules
import { log, syslog, initLogging, setupLogTabs } from './modules/logging.js';
import { checkConnectedTabs, updateTabStatus } from './modules/connection.js';
import { initNormalMode, setupNormalMode } from './modules/normal-mode.js';
import { initEvaluation } from './modules/evaluation.js';
import {
  setupDiscussionMode,
  handleDiscussionResponse,
  discussionState
} from './modules/discussion.js';

// DOM Elements
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logContainer = document.getElementById('log-container');
const syslogContainer = document.getElementById('syslog-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize modules with DOM references
  initLogging(logContainer, syslogContainer);
  initNormalMode(messageInput, sendBtn);
  initEvaluation(messageInput);

  // Setup all modules
  checkConnectedTabs();
  setupNormalMode();
  setupDiscussionMode();
  setupLogTabs();

  // Setup Chrome message listener
  setupMessageListener();
});

/**
 * Setup Chrome runtime message listener
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    syslog('debug', 'message', `收到訊息: ${message.type}`, { sender: sender?.tab?.id, data: message });

    if (message.type === 'TAB_STATUS_UPDATE') {
      updateTabStatus(message.aiType, message.connected);
      syslog('info', 'connection', `分頁狀態更新: ${message.aiType}`, { connected: message.connected });
    } else if (message.type === 'RESPONSE_CAPTURED') {
      log(`${message.aiType}: 已擷取回覆`, 'success');
      syslog('info', 'response', `回覆已擷取: ${message.aiType}`, {
        contentLength: message.content?.length || 0,
        preview: message.content?.substring(0, 100)
      });
      // Handle discussion mode response
      if (discussionState.active && discussionState.pendingResponses.has(message.aiType)) {
        handleDiscussionResponse(message.aiType, message.content);
      }
    } else if (message.type === 'SEND_RESULT') {
      if (message.success) {
        log(`${message.aiType}: 訊息已傳送`, 'success');
        syslog('info', 'send', `訊息傳送成功: ${message.aiType}`);
      } else {
        log(`${message.aiType}: 失敗 - ${message.error}`, 'error');
        syslog('error', 'send', `訊息傳送失敗: ${message.aiType}`, { error: message.error });
      }
    }
  });
}
