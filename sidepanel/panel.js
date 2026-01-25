/**
 * AI Roundtable - Side Panel Controller
 * 
 * Original Author: Axton Liu (MIT License)
 * Modifications by: Wei Topaz (2026)
 * 
 * See MODIFICATIONS.md for detailed change log.
 */

// AI Panel - Side Panel Controller

const AI_TYPES = ['claude', 'chatgpt', 'gemini'];

// Cross-reference action keywords (inserted into message)
// New structure: simplified Chinese-first naming
const CROSS_REF_ACTIONS = {
  // 🔄 互評
  mutual: { type: 'mutual', prompt: '' },
  // 📝 請...評價 (需要彈出選擇來源)
  'ask-claude': { type: 'ask', evaluator: 'claude' },
  'ask-chatgpt': { type: 'ask', evaluator: 'chatgpt' },
  'ask-gemini': { type: 'ask', evaluator: 'gemini' },
  // ⚙️ 進階
  'advanced-cross': { type: 'advanced' }
};

// Tone prompts mapping
const TONE_PROMPTS = {
  general: '請綜合評價以上觀點。你同意什麼？不同意什麼？有什麼補充？',
  pros: '請指出以上回覆中值得學習的優點與亮點。',
  cons: '請指出以上回覆中的問題、不足或可改進之處。',
  add: '請補充以上回覆中遺漏的內容或重要考量。',
  compare: '請對比以上觀點與你的看法，分析異同。'
};

// Pending action state for modal flow
let pendingAction = null;

// DOM Elements
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const logContainer = document.getElementById('log-container');
const syslogContainer = document.getElementById('syslog-container');

// System Log State - only starts recording when tab is first activated
let systemLogEnabled = false;

// Track connected tabs
const connectedTabs = {
  claude: null,
  chatgpt: null,
  gemini: null
};

// Discussion Mode State
let discussionState = {
  active: false,
  topic: '',
  participants: [],  // [ai1, ai2]
  currentRound: 0,
  history: [],  // [{round, ai, type: 'initial'|'evaluation'|'response', content}]
  pendingResponses: new Set(),  // AIs we're waiting for
  roundType: null  // 'initial', 'cross-eval', 'counter'
};


// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkConnectedTabs();
  setupEventListeners();
  setupDiscussionMode();
  setupLogTabs();
});

function setupEventListeners() {
  sendBtn.addEventListener('click', handleSend);

  // Enter to send, Shift+Enter for new line (like ChatGPT)
  // But ignore Enter during IME composition (e.g., Chinese input)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });

  // Action select - handle different action types
  document.getElementById('action-select').addEventListener('change', (e) => {
    const action = e.target.value;
    if (!action) return;

    const actionConfig = CROSS_REF_ACTIONS[action];
    if (!actionConfig) {
      e.target.value = '';
      return;
    }

    switch (actionConfig.type) {
      case 'mutual':
        // 直接執行互評（使用勾選的 AI）
        handleMutualFromMenu();
        break;

      case 'ask':
        // 開啟 modal 選擇來源
        openSourceModal(actionConfig.evaluator, 'single');
        break;

      case 'advanced':
        // 開啟進階 modal（多對一）
        openSourceModal(null, 'advanced');
        break;
    }

    // Reset select to placeholder
    e.target.value = '';
  });

  // Modal event listeners
  setupModalListeners();

  // Listen for messages from background script
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

async function checkConnectedTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      const aiType = getAITypeFromUrl(tab.url);
      if (aiType) {
        connectedTabs[aiType] = tab.id;
        updateTabStatus(aiType, true);
      }
    }
  } catch (err) {
    log('檢查分頁時發生錯誤: ' + err.message, 'error');
  }
}

function getAITypeFromUrl(url) {
  if (!url) return null;
  if (url.includes('claude.ai')) return 'claude';
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'chatgpt';
  if (url.includes('gemini.google.com')) return 'gemini';
  return null;
}

function updateTabStatus(aiType, connected) {
  const statusEl = document.getElementById(`status-${aiType}`);
  if (statusEl) {
    statusEl.textContent = connected ? '已連線' : '未找到';
    statusEl.className = 'status ' + (connected ? 'connected' : 'disconnected');
  }

  // Update connection indicator in normal mode
  const indicatorEl = document.getElementById(`indicator-${aiType}`);
  if (indicatorEl) {
    if (connected) {
      indicatorEl.classList.add('connected');
    } else {
      indicatorEl.classList.remove('connected');
    }
  }

  // Update connection indicator in discussion mode
  const participantIndicatorEl = document.getElementById(`participant-indicator-${aiType}`);
  if (participantIndicatorEl) {
    if (connected) {
      participantIndicatorEl.classList.add('connected');
    } else {
      participantIndicatorEl.classList.remove('connected');
    }
  }

  if (connected) {
    connectedTabs[aiType] = true;
  }
}

async function handleSend() {
  const message = messageInput.value.trim();
  if (!message) return;

  // Parse message for @ mentions
  const parsed = parseMessage(message);

  // Determine targets
  let targets;
  if (parsed.mentions.length > 0) {
    // If @ mentioned specific AIs, only send to those
    targets = parsed.mentions;
  } else {
    // Otherwise use checkbox selection
    targets = AI_TYPES.filter(ai => {
      const checkbox = document.getElementById(`target-${ai}`);
      return checkbox && checkbox.checked;
    });
  }

  if (targets.length === 0) {
    log('未選取任何目標', 'error');
    return;
  }

  sendBtn.disabled = true;

  // Clear input immediately after sending
  messageInput.value = '';

  try {
    // If mutual review, handle specially
    if (parsed.mutual) {
      if (targets.length < 2) {
        log('互評需要至少選取 2 個 AI', 'error');
      } else {
        log(`互評: ${targets.join(', ')}`);
        await handleMutualReview(targets, parsed.prompt);
      }
    }
    // If cross-reference, handle specially
    else if (parsed.crossRef) {
      log(`交叉引用: ${parsed.targetAIs.join(', ')} <- ${parsed.sourceAIs.join(', ')}`);
      await handleCrossReference(parsed);
    } else {
      // Send to target(s)
      log(`傳送至: ${targets.join(', ')}`);
      for (const target of targets) {
        await sendToAI(target, message);
      }
    }
  } catch (err) {
    log('錯誤: ' + err.message, 'error');
  }

  sendBtn.disabled = false;
  messageInput.focus();
}

function parseMessage(message) {
  // Check for /mutual command: /mutual [optional prompt]
  // Triggers mutual review based on current responses (no new topic needed)
  const trimmedMessage = message.trim();
  if (trimmedMessage.toLowerCase() === '/mutual' || trimmedMessage.toLowerCase().startsWith('/mutual ')) {
    // Extract everything after "/mutual " as the prompt
    const prompt = trimmedMessage.length > 7 ? trimmedMessage.substring(7).trim() : '';
    return {
      mutual: true,
      prompt: prompt || '請評價以上觀點。你同意什麼？不同意什麼？有什麼補充？',
      crossRef: false,
      mentions: [],
      originalMessage: message
    };
  }

  // Check for /cross command first: /cross @targets <- @sources message
  // Use this for complex cases (3 AIs, or when you want to be explicit)
  if (message.trim().toLowerCase().startsWith('/cross ')) {
    const arrowIndex = message.indexOf('<-');
    if (arrowIndex === -1) {
      // No arrow found, treat as regular message
      return { crossRef: false, mentions: [], originalMessage: message };
    }

    const beforeArrow = message.substring(7, arrowIndex).trim(); // Skip "/cross "
    const afterArrow = message.substring(arrowIndex + 2).trim();  // Skip "<-"

    // Extract targets (before arrow)
    const mentionPattern = /@(claude|chatgpt|gemini)/gi;
    const targetMatches = [...beforeArrow.matchAll(mentionPattern)];
    const targetAIs = [...new Set(targetMatches.map(m => m[1].toLowerCase()))];

    // Extract sources and message (after arrow)
    // Find all @mentions in afterArrow, sources are all @mentions
    // Message is everything after the last @mention
    const sourceMatches = [...afterArrow.matchAll(mentionPattern)];
    const sourceAIs = [...new Set(sourceMatches.map(m => m[1].toLowerCase()))];

    // Find where the actual message starts (after the last @mention)
    let actualMessage = afterArrow;
    if (sourceMatches.length > 0) {
      const lastMatch = sourceMatches[sourceMatches.length - 1];
      const lastMentionEnd = lastMatch.index + lastMatch[0].length;
      actualMessage = afterArrow.substring(lastMentionEnd).trim();
    }

    if (targetAIs.length > 0 && sourceAIs.length > 0) {
      return {
        crossRef: true,
        mentions: [...targetAIs, ...sourceAIs],
        targetAIs,
        sourceAIs,
        originalMessage: actualMessage
      };
    }
  }

  // Pattern-based detection for @ mentions
  const mentionPattern = /@(claude|chatgpt|gemini)/gi;
  const matches = [...message.matchAll(mentionPattern)];
  const mentions = [...new Set(matches.map(m => m[1].toLowerCase()))];

  // For exactly 2 AIs: use keyword detection (simpler syntax)
  // Last mentioned = source (being evaluated), first = target (doing evaluation)
  if (mentions.length === 2) {
    const evalKeywords = /評價|看看|怎麼樣|怎麼看|如何|講的|說的|回答|贊同|同意|分析|認為|觀點|看法|意見|借鑑|批評|補充|對比|evaluate|think of|opinion|review|agree|analysis|compare|learn from/i;

    if (evalKeywords.test(message)) {
      const sourceAI = matches[matches.length - 1][1].toLowerCase();
      const targetAI = matches[0][1].toLowerCase();

      return {
        crossRef: true,
        mentions,
        targetAIs: [targetAI],
        sourceAIs: [sourceAI],
        originalMessage: message
      };
    }
  }

  // For 3+ AIs without /cross command: just send to all (no cross-reference)
  // User should use /cross command for complex 3-AI scenarios
  return {
    crossRef: false,
    mentions,
    originalMessage: message
  };
}

async function handleCrossReference(parsed) {
  // Get responses from all source AIs
  const sourceResponses = [];

  for (const sourceAI of parsed.sourceAIs) {
    const response = await getLatestResponse(sourceAI);
    if (!response) {
      log(`無法取得 ${sourceAI} 的回覆`, 'error');
      return;
    }
    sourceResponses.push({ ai: sourceAI, content: response });
  }

  // Build the full message with XML tags for each source
  let fullMessage = parsed.originalMessage + '\n';

  for (const source of sourceResponses) {
    fullMessage += `
<${source.ai}_response>
${source.content}
</${source.ai}_response>`;
  }

  // Send to all target AIs
  for (const targetAI of parsed.targetAIs) {
    await sendToAI(targetAI, fullMessage);
  }
}

// ============================================
// Mutual Review Functions
// ============================================

async function handleMutualReview(participants, prompt) {
  // Get current responses from all participants
  const responses = {};

  log(`[互評] 正在取得 ${participants.join(', ')} 的回覆...`);

  for (const ai of participants) {
    const response = await getLatestResponse(ai);
    if (!response || response.trim().length === 0) {
      log(`[互評] 無法取得 ${ai} 的回覆 - 請確認 ${ai} 已經回覆`, 'error');
      return;
    }
    responses[ai] = response;
    log(`[互評] 已取得 ${ai} 的回覆 (${response.length} 字元)`);
  }

  log(`[互評] 已收集所有回覆，正在傳送交叉評價...`);

  // For each AI, send them the responses from all OTHER AIs
  for (const targetAI of participants) {
    const otherAIs = participants.filter(ai => ai !== targetAI);

    // Build message with all other AIs' responses
    let evalMessage = `以下是其他 AI 的觀點：\n`;

    for (const sourceAI of otherAIs) {
      evalMessage += `
<${sourceAI}_response>
${responses[sourceAI]}
</${sourceAI}_response>
`;
    }

    evalMessage += `\n${prompt}`;

    log(`[互評] 傳送至 ${targetAI}: ${otherAIs.join('+')} 回覆 + 提示`);
    await sendToAI(targetAI, evalMessage);
  }

  log(`[互評] 完成！所有 ${participants.length} 個 AI 都已收到交叉評價`, 'success');
}

// ============================================
// New Action System Helper Functions
// ============================================

/**
 * Insert text at current cursor position in message input
 */
function insertTextAtCursor(text) {
  const cursorPos = messageInput.selectionStart;
  const textBefore = messageInput.value.substring(0, cursorPos);
  const textAfter = messageInput.value.substring(cursorPos);

  // Add space before if needed
  const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ') && !textBefore.endsWith('\n');
  const insertText = (needsSpaceBefore ? ' ' : '') + text + ' ';

  messageInput.value = textBefore + insertText + textAfter;
  messageInput.focus();
  messageInput.selectionStart = messageInput.selectionEnd = cursorPos + insertText.length;
}

/**
 * Handle mutual evaluation triggered from menu (using checkbox-selected AIs)
 */
async function handleMutualFromMenu() {
  const targets = AI_TYPES.filter(ai => {
    const checkbox = document.getElementById(`target-${ai}`);
    return checkbox && checkbox.checked;
  });

  if (targets.length < 2) {
    log('互評需要至少選取 2 個 AI', 'error');
    return;
  }

  const additionalPrompt = messageInput.value.trim();
  const prompt = additionalPrompt || '請評價以上觀點。你同意什麼？不同意什麼？有什麼補充？';

  log(`[互評] ${targets.join(', ')}`);
  messageInput.value = '';

  await handleMutualReview(targets, prompt);
}

/**
 * Open source selection modal
 * @param {string|null} evaluator - The AI that will do the evaluation (null for advanced mode)
 * @param {string} mode - 'single' (one evaluator) or 'advanced' (multiple evaluators)
 */
function openSourceModal(evaluator, mode) {
  const modal = document.getElementById('source-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const confirmBtn = document.getElementById('modal-confirm');

  // Store pending action
  pendingAction = { evaluator, mode };

  // Update modal content based on mode
  if (mode === 'single') {
    const displayName = capitalize(evaluator);
    modalTitle.textContent = `請 ${displayName} 評價`;
    modalSubtitle.textContent = `選擇要讓 ${displayName} 評價誰的回覆：`;

    // Disable the evaluator's own checkbox
    document.querySelectorAll('#modal-options input[name="source"]').forEach(cb => {
      const option = cb.closest('.modal-option');
      if (cb.value === evaluator) {
        option.classList.add('disabled');
        cb.checked = false;
        cb.disabled = true;
      } else {
        option.classList.remove('disabled');
        cb.disabled = false;
      }
    });
  } else {
    modalTitle.textContent = '指定來源評價';
    modalSubtitle.textContent = '選擇評價者與被評價者（進階模式開發中）';

    // Enable all checkboxes
    document.querySelectorAll('#modal-options input[name="source"]').forEach(cb => {
      const option = cb.closest('.modal-option');
      option.classList.remove('disabled');
      cb.disabled = false;
    });
  }

  // Reset checkboxes
  document.querySelectorAll('#modal-options input[name="source"]').forEach(cb => {
    if (!cb.disabled) cb.checked = false;
  });

  // Update confirm button state
  confirmBtn.disabled = true;

  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Setup modal event listeners
 */
function setupModalListeners() {
  const modal = document.getElementById('source-modal');
  const cancelBtn = document.getElementById('modal-cancel');
  const confirmBtn = document.getElementById('modal-confirm');

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    pendingAction = null;
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      pendingAction = null;
    }
  });

  // Update confirm button state on checkbox change
  document.querySelectorAll('#modal-options input[name="source"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const selected = document.querySelectorAll('#modal-options input[name="source"]:checked');
      confirmBtn.disabled = selected.length === 0;
    });
  });

  // Confirm button
  confirmBtn.addEventListener('click', async () => {
    const selectedSources = Array.from(
      document.querySelectorAll('#modal-options input[name="source"]:checked')
    ).map(cb => cb.value);

    if (selectedSources.length === 0) return;

    // Get selected tone
    const toneSelect = document.getElementById('modal-tone-select');
    const selectedTone = toneSelect ? toneSelect.value : 'general';

    modal.classList.add('hidden');

    if (pendingAction && pendingAction.mode === 'single') {
      await handleDirectedEvaluation(pendingAction.evaluator, selectedSources, selectedTone);
    }

    pendingAction = null;
  });
}

/**
 * Handle directed evaluation (one AI evaluates others)
 * @param {string} evaluator - The AI that will do the evaluation
 * @param {string[]} sources - The AIs whose responses will be evaluated
 * @param {string} tone - The evaluation tone/focus (general, pros, cons, add, compare)
 */
async function handleDirectedEvaluation(evaluator, sources, tone = 'general') {
  log(`[單向評價] ${capitalize(evaluator)} 評價 ${sources.join(', ')}`);

  // Get responses from all source AIs
  const sourceResponses = [];

  for (const sourceAI of sources) {
    const response = await getLatestResponse(sourceAI);
    if (!response) {
      log(`無法取得 ${sourceAI} 的回覆`, 'error');
      return;
    }
    sourceResponses.push({ ai: sourceAI, content: response });
  }

  // Get prompt based on tone, with additional user input if any
  const additionalPrompt = messageInput.value.trim();
  const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.general;
  const prompt = additionalPrompt ? `${tonePrompt}

${additionalPrompt}` : tonePrompt;

  // Build the full message with XML tags for each source
  let fullMessage = '';

  for (const source of sourceResponses) {
    fullMessage += `以下是 ${capitalize(source.ai)} 的回覆：

<${source.ai}_response>
${source.content}
</${source.ai}_response>

`;
  }

  fullMessage += prompt;

  // Clear input
  messageInput.value = '';

  // Send to evaluator
  await sendToAI(evaluator, fullMessage);

  log(`[單向評價] 完成！已傳送 ${sources.length} 個回覆給 ${capitalize(evaluator)}`, 'success');
}

async function getLatestResponse(aiType) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GET_RESPONSE', aiType },
      (response) => {
        resolve(response?.content || null);
      }
    );
  });
}

/**
 * Check if Prompt Repetition is enabled
 * Checks both normal mode and discussion mode checkboxes
 */
function isPromptRepetitionEnabled() {
  const normalModeCheckbox = document.getElementById('prompt-repetition');
  const discussionModeCheckbox = document.getElementById('prompt-repetition-discussion');

  // Check which mode is active and return the corresponding checkbox state
  const discussionMode = document.getElementById('discussion-mode');
  if (discussionMode && !discussionMode.classList.contains('hidden')) {
    return discussionModeCheckbox?.checked || false;
  }
  return normalModeCheckbox?.checked || false;
}

async function sendToAI(aiType, message) {
  // Apply prompt repetition if enabled
  let finalMessage = message;
  if (isPromptRepetitionEnabled()) {
    finalMessage = message + '\n\n---\n\n' + message;
    syslog('debug', 'send', `Prompt Repetition enabled, duplicating message`);
  }

  syslog('debug', 'send', `準備傳送訊息至 ${aiType}`, { messageLength: finalMessage.length });

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SEND_MESSAGE', aiType, message: finalMessage },
      (response) => {
        if (response?.success) {
          log(`已傳送至 ${aiType}`, 'success');
          syslog('info', 'send', `訊息已傳送至 ${aiType}`, { messageLength: finalMessage.length });
        } else {
          log(`傳送至 ${aiType} 失敗: ${response?.error || '未知錯誤'}`, 'error');
          syslog('error', 'send', `傳送失敗: ${aiType}`, { error: response?.error });
        }
        resolve(response);
      }
    );
  });
}

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (type !== 'info' ? ` ${type}` : '');

  const now = new Date();
  const date = now.toISOString().substring(0, 10); // YYYY-MM-DD
  const time = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const fullTime = `${date} ${time}`;

  entry.innerHTML = `<span class="time">${fullTime}</span>${message}`;
  logContainer.insertBefore(entry, logContainer.firstChild);

  // Keep only last 50 entries
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// ============================================
// Log Tab Functions
// ============================================

function setupLogTabs() {
  const tabActivity = document.getElementById('tab-activity');
  const tabSystem = document.getElementById('tab-system');

  tabActivity.addEventListener('click', () => switchLogTab('activity'));
  tabSystem.addEventListener('click', () => switchLogTab('system'));

  // Copy button
  document.getElementById('log-copy-btn').addEventListener('click', copyLogContent);

  // Clear button
  document.getElementById('log-clear-btn').addEventListener('click', clearLogContent);
}

// Track current active log tab
let currentLogTab = 'activity';

function switchLogTab(tab) {
  currentLogTab = tab;
  const tabActivity = document.getElementById('tab-activity');
  const tabSystem = document.getElementById('tab-system');
  const activityContainer = document.getElementById('log-container');
  const systemContainer = document.getElementById('syslog-container');

  if (tab === 'activity') {
    tabActivity.classList.add('active');
    tabSystem.classList.remove('active');
    activityContainer.classList.remove('hidden');
    systemContainer.classList.add('hidden');
  } else {
    tabActivity.classList.remove('active');
    tabSystem.classList.add('active');
    activityContainer.classList.add('hidden');
    systemContainer.classList.remove('hidden');

    // Enable system logging on first activation
    if (!systemLogEnabled) {
      systemLogEnabled = true;
      syslog('info', 'panel', '系統日誌已啟用');
    }
  }
}

/**
 * System Log - Detailed logging for developers
 * @param {string} level - 'info' | 'debug' | 'warn' | 'error'
 * @param {string} source - Source module (e.g., 'panel', 'message', 'discussion')
 * @param {string} message - Log message
 * @param {object} context - Optional context data
 */
function syslog(level, source, message, context = null) {
  // Only record if system log is enabled
  if (!systemLogEnabled) return;

  const entry = document.createElement('div');
  entry.className = 'syslog-entry';

  const now = new Date();
  // Format: YYYY-MM-DD HH:mm:ss.SSS+HH:MM (with date and timezone)
  const dateStr = now.toISOString().substring(0, 10); // YYYY-MM-DD
  const timeBase = now.toISOString().substring(11, 23); // HH:mm:ss.SSS
  const tzOffset = -now.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const time = `${dateStr} ${timeBase}${tzSign}${tzHours}:${tzMins}`;

  let html = `<span class="syslog-time">${time}</span> `;
  html += `<span class="syslog-level ${level}">${level.toUpperCase()}</span> `;
  html += `<span class="syslog-source">[${source}]</span> `;
  html += `<span class="syslog-message">${escapeHtml(message)}</span>`;

  if (context) {
    const contextStr = typeof context === 'string' ? context : JSON.stringify(context);
    html += `<span class="syslog-context">${escapeHtml(contextStr)}</span>`;
  }

  entry.innerHTML = html;
  syslogContainer.insertBefore(entry, syslogContainer.firstChild);

  // Keep only last 500 entries (more than activity log for debugging)
  while (syslogContainer.children.length > 500) {
    syslogContainer.removeChild(syslogContainer.lastChild);
  }
}

/**
 * Copy the content of the currently active log tab to clipboard
 */
async function copyLogContent() {
  const btn = document.getElementById('log-copy-btn');
  const container = currentLogTab === 'activity' ? logContainer : syslogContainer;

  // Extract text content from all log entries
  const entries = container.querySelectorAll(currentLogTab === 'activity' ? '.log-entry' : '.syslog-entry');
  let textContent = '';

  entries.forEach((entry) => {
    textContent += entry.textContent + '\n';
  });

  try {
    await navigator.clipboard.writeText(textContent.trim());

    // Visual feedback
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');

    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('copied');
    }, 1000);

    syslog('info', 'clipboard', `已複製 ${entries.length} 筆 ${currentLogTab === 'activity' ? '活動紀錄' : '系統日誌'}`);
  } catch (err) {
    syslog('error', 'clipboard', '複製失敗', { error: err.message });
  }
}

/**
 * Clear the content of the currently active log tab
 */
function clearLogContent() {
  const btn = document.getElementById('log-clear-btn');
  const container = currentLogTab === 'activity' ? logContainer : syslogContainer;

  // Count entries before clearing
  const entrySelector = currentLogTab === 'activity' ? '.log-entry' : '.syslog-entry';
  const entryCount = container.querySelectorAll(entrySelector).length;

  // Clear all entries
  container.innerHTML = '';

  // Visual feedback
  const originalText = btn.textContent;
  btn.textContent = 'Cleared!';
  btn.classList.add('cleared');

  setTimeout(() => {
    btn.textContent = originalText;
    btn.classList.remove('cleared');
  }, 1000);

  // Log the clear action (only to system log if we cleared activity log)
  if (currentLogTab === 'activity') {
    syslog('info', 'log', `已清除活動紀錄 (${entryCount} 筆)`);
  } else {
    // If clearing system log, we can still log to activity
    log(`已清除系統日誌 (${entryCount} 筆)`);
  }
}

// ============================================
// Discussion Mode Functions
// ============================================

function setupDiscussionMode() {
  // Mode switcher buttons
  document.getElementById('mode-normal').addEventListener('click', () => switchMode('normal'));
  document.getElementById('mode-discussion').addEventListener('click', () => switchMode('discussion'));

  // Discussion controls
  document.getElementById('start-discussion-btn').addEventListener('click', startDiscussion);
  document.getElementById('next-round-btn').addEventListener('click', nextRound);
  document.getElementById('end-discussion-btn').addEventListener('click', endDiscussion);
  document.getElementById('generate-summary-btn').addEventListener('click', generateSummary);
  document.getElementById('new-discussion-btn').addEventListener('click', resetDiscussion);
  document.getElementById('interject-btn').addEventListener('click', handleInterject);

  // Participant selection validation
  document.querySelectorAll('input[name="participant"]').forEach(checkbox => {
    checkbox.addEventListener('change', validateParticipants);
  });
}

function switchMode(mode) {
  const normalMode = document.getElementById('normal-mode');
  const discussionMode = document.getElementById('discussion-mode');
  const normalBtn = document.getElementById('mode-normal');
  const discussionBtn = document.getElementById('mode-discussion');

  if (mode === 'normal') {
    normalMode.classList.remove('hidden');
    discussionMode.classList.add('hidden');
    normalBtn.classList.add('active');
    discussionBtn.classList.remove('active');
  } else {
    normalMode.classList.add('hidden');
    discussionMode.classList.remove('hidden');
    normalBtn.classList.remove('active');
    discussionBtn.classList.add('active');
  }
}

function validateParticipants() {
  const selected = document.querySelectorAll('input[name="participant"]:checked');
  const startBtn = document.getElementById('start-discussion-btn');
  startBtn.disabled = selected.length !== 2;
}

async function startDiscussion() {
  const topic = document.getElementById('discussion-topic').value.trim();
  if (!topic) {
    log('請輸入討論主題', 'error');
    return;
  }

  const selected = Array.from(document.querySelectorAll('input[name="participant"]:checked'))
    .map(cb => cb.value);

  if (selected.length !== 2) {
    log('請選擇 2 位參與者', 'error');
    return;
  }

  // Initialize discussion state
  discussionState = {
    active: true,
    topic: topic,
    participants: selected,
    currentRound: 1,
    history: [],
    pendingResponses: new Set(selected),
    roundType: 'initial'
  };

  // Update UI
  document.getElementById('discussion-setup').classList.add('hidden');
  document.getElementById('discussion-active').classList.remove('hidden');
  document.getElementById('round-badge').textContent = '第 1 輪';
  document.getElementById('participants-badge').textContent =
    `${capitalize(selected[0])} vs ${capitalize(selected[1])}`;
  document.getElementById('topic-display').textContent = topic;
  updateDiscussionStatus('waiting', `等待 ${selected.join(' 和 ')} 的初始回覆...`);

  // Disable buttons during round
  document.getElementById('next-round-btn').disabled = true;
  document.getElementById('generate-summary-btn').disabled = true;

  log(`討論開始: ${selected.join(' vs ')}`, 'success');

  // Send topic to both AIs
  for (const ai of selected) {
    await sendToAI(ai, `請分享你對以下主題的看法：\n\n${topic}`);
  }
}

function handleDiscussionResponse(aiType, content) {
  if (!discussionState.active) return;

  // Record this response in history
  discussionState.history.push({
    round: discussionState.currentRound,
    ai: aiType,
    type: discussionState.roundType,
    content: content
  });

  // Remove from pending
  discussionState.pendingResponses.delete(aiType);

  log(`討論: ${aiType} 已回覆 (第 ${discussionState.currentRound} 輪)`, 'success');

  // Check if all pending responses received
  if (discussionState.pendingResponses.size === 0) {
    onRoundComplete();
  } else {
    const remaining = Array.from(discussionState.pendingResponses).join(', ');
    updateDiscussionStatus('waiting', `等待 ${remaining}...`);
  }
}

function onRoundComplete() {
  log(`第 ${discussionState.currentRound} 輪完成`, 'success');
  updateDiscussionStatus('ready', `第 ${discussionState.currentRound} 輪完成，可以進入下一輪`);

  // Enable next round button
  document.getElementById('next-round-btn').disabled = false;
  document.getElementById('generate-summary-btn').disabled = false;
}

async function nextRound() {
  discussionState.currentRound++;
  const [ai1, ai2] = discussionState.participants;

  // Update UI
  document.getElementById('round-badge').textContent = `第 ${discussionState.currentRound} 輪`;
  document.getElementById('next-round-btn').disabled = true;
  document.getElementById('generate-summary-btn').disabled = true;

  // Get previous round responses
  const prevRound = discussionState.currentRound - 1;
  const ai1Response = discussionState.history.find(
    h => h.round === prevRound && h.ai === ai1
  )?.content;
  const ai2Response = discussionState.history.find(
    h => h.round === prevRound && h.ai === ai2
  )?.content;

  if (!ai1Response || !ai2Response) {
    log('缺少上一輪的回覆', 'error');
    return;
  }

  // Set pending responses
  discussionState.pendingResponses = new Set([ai1, ai2]);
  discussionState.roundType = 'cross-eval';

  updateDiscussionStatus('waiting', `交叉評價: ${ai1} 評價 ${ai2}，${ai2} 評價 ${ai1}...`);

  log(`第 ${discussionState.currentRound} 輪: 交叉評價開始`);

  // Send cross-evaluation requests
  // AI1 evaluates AI2's response
  const msg1 = `以下是 ${capitalize(ai2)} 針對主題「${discussionState.topic}」的回覆：

<${ai2}_response>
${ai2Response}
</${ai2}_response>

請評價這個回覆。你同意什麼？不同意什麼？你會補充或修改什麼？`;

  // AI2 evaluates AI1's response
  const msg2 = `以下是 ${capitalize(ai1)} 針對主題「${discussionState.topic}」的回覆：

<${ai1}_response>
${ai1Response}
</${ai1}_response>

請評價這個回覆。你同意什麼？不同意什麼？你會補充或修改什麼？`;

  await sendToAI(ai1, msg1);
  await sendToAI(ai2, msg2);
}

async function handleInterject() {
  const input = document.getElementById('interject-input');
  const message = input.value.trim();

  if (!message) {
    log('請輸入要傳送的訊息', 'error');
    return;
  }

  if (!discussionState.active || discussionState.participants.length === 0) {
    log('目前沒有進行中的討論', 'error');
    return;
  }

  const btn = document.getElementById('interject-btn');
  btn.disabled = true;

  const [ai1, ai2] = discussionState.participants;

  log(`[插話] 正在取得雙方最新回覆...`);

  // Get latest responses from both participants
  const ai1Response = await getLatestResponse(ai1);
  const ai2Response = await getLatestResponse(ai2);

  if (!ai1Response || !ai2Response) {
    log(`[插話] 無法取得回覆，請確認雙方都已回覆`, 'error');
    btn.disabled = false;
    return;
  }

  log(`[插話] 已取得雙方回覆，正在傳送...`);

  // Send to AI1: user message + AI2's response
  const msg1 = `${message}

以下是 ${capitalize(ai2)} 的最新回覆：

<${ai2}_response>
${ai2Response}
</${ai2}_response>`;

  // Send to AI2: user message + AI1's response
  const msg2 = `${message}

以下是 ${capitalize(ai1)} 的最新回覆：

<${ai1}_response>
${ai1Response}
</${ai1}_response>`;

  await sendToAI(ai1, msg1);
  await sendToAI(ai2, msg2);

  log(`[插話] 已傳送給雙方（含對方回覆）`, 'success');

  // Clear input
  input.value = '';
  btn.disabled = false;
}

async function generateSummary() {
  document.getElementById('generate-summary-btn').disabled = true;
  updateDiscussionStatus('waiting', '正在請求雙方產生摘要...');

  const [ai1, ai2] = discussionState.participants;

  // Build conversation history for summary
  let historyText = `主題: ${discussionState.topic}\n\n`;

  for (let round = 1; round <= discussionState.currentRound; round++) {
    historyText += `=== 第 ${round} 輪 ===\n\n`;
    const roundEntries = discussionState.history.filter(h => h.round === round);
    for (const entry of roundEntries) {
      historyText += `[${capitalize(entry.ai)}]:\n${entry.content}\n\n`;
    }
  }

  const summaryPrompt = `請對以下 AI 之間的討論進行摘要。請包含：
1. 主要共識點
2. 主要分歧點
3. 各方的核心觀點
4. 總體結論

討論歷史：
${historyText}`;

  // Send to both AIs
  discussionState.roundType = 'summary';
  discussionState.pendingResponses = new Set([ai1, ai2]);

  log(`[摘要] 正在請求雙方產生摘要...`);
  await sendToAI(ai1, summaryPrompt);
  await sendToAI(ai2, summaryPrompt);

  // Wait for both responses, then show summary
  // 設置超時保護：最多等待 5 分鐘
  let summaryTimeout = null;
  const checkForSummary = setInterval(async () => {
    if (discussionState.pendingResponses.size === 0) {
      clearInterval(checkForSummary);
      if (summaryTimeout) clearTimeout(summaryTimeout);

      // Get both summaries
      const summaries = discussionState.history.filter(h => h.type === 'summary');
      const ai1Summary = summaries.find(s => s.ai === ai1)?.content || '';
      const ai2Summary = summaries.find(s => s.ai === ai2)?.content || '';

      log(`[摘要] 雙方摘要已產生`, 'success');
      showSummary(ai1Summary, ai2Summary);
    }
  }, 500);

  // 超時保護：5 分鐘後強制停止
  summaryTimeout = setTimeout(() => {
    clearInterval(checkForSummary);
    log('[摘要] 超時：未在時限內收到回覆', 'error');
    updateDiscussionStatus('error', '摘要請求超時');
    document.getElementById('generate-summary-btn').disabled = false;
  }, 300000);
}

function showSummary(ai1Summary, ai2Summary) {
  document.getElementById('discussion-active').classList.add('hidden');
  document.getElementById('discussion-summary').classList.remove('hidden');

  const [ai1, ai2] = discussionState.participants;

  // Handle empty summaries
  if (!ai1Summary && !ai2Summary) {
    log('警告: 未收到 AI 的摘要內容', 'error');
  }

  // Build summary HTML - show both summaries side by side conceptually
  let html = `<div class="round-summary">
    <h4>雙方摘要對比</h4>
    <div class="summary-comparison">
      <div class="ai-response">
        <div class="ai-name ${ai1}">${capitalize(ai1)} 的摘要：</div>
        <div>${escapeHtml(ai1Summary).replace(/\n/g, '<br>')}</div>
      </div>
      <div class="ai-response">
        <div class="ai-name ${ai2}">${capitalize(ai2)} 的摘要：</div>
        <div>${escapeHtml(ai2Summary).replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  </div>`;

  // Add round-by-round history
  html += `<div class="round-summary"><h4>完整討論歷史</h4>`;
  for (let round = 1; round <= discussionState.currentRound; round++) {
    const roundEntries = discussionState.history.filter(h => h.round === round && h.type !== 'summary');
    if (roundEntries.length > 0) {
      html += `<div style="margin-top:12px"><strong>第 ${round} 輪</strong></div>`;
      for (const entry of roundEntries) {
        const preview = entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : '');
        html += `<div class="ai-response">
          <div class="ai-name ${entry.ai}">${capitalize(entry.ai)}:</div>
          <div>${escapeHtml(preview).replace(/\n/g, '<br>')}</div>
        </div>`;
      }
    }
  }
  html += `</div>`;

  document.getElementById('summary-content').innerHTML = html;
  discussionState.active = false;
  log('討論摘要已產生', 'success');
}

function endDiscussion() {
  if (confirm('確定結束討論嗎？建議先產生摘要。')) {
    resetDiscussion();
  }
}

function resetDiscussion() {
  discussionState = {
    active: false,
    topic: '',
    participants: [],
    currentRound: 0,
    history: [],
    pendingResponses: new Set(),
    roundType: null
  };

  // Reset UI
  document.getElementById('discussion-setup').classList.remove('hidden');
  document.getElementById('discussion-active').classList.add('hidden');
  document.getElementById('discussion-summary').classList.add('hidden');
  document.getElementById('discussion-topic').value = '';
  document.getElementById('next-round-btn').disabled = true;
  document.getElementById('generate-summary-btn').disabled = true;

  log('討論已結束');
}

function updateDiscussionStatus(state, text) {
  const statusEl = document.getElementById('discussion-status');
  statusEl.textContent = text;
  statusEl.className = 'discussion-status ' + state;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
