/**
 * AI Roundtable - Discussion Mode Module
 * 
 * Handles the structured AI discussion mode including rounds,
 * cross-evaluation, interjection, and summary generation.
 */

import { TIMEOUTS } from './config.js';
import { capitalize, escapeHtml } from './utils.js';
import { log } from './logging.js';
import { getLatestResponse, sendToAI } from './messaging.js';

// Discussion Mode State
export let discussionState = {
    active: false,
    topic: '',
    participants: [],  // [ai1, ai2]
    currentRound: 0,
    history: [],  // [{round, ai, type: 'initial'|'evaluation'|'response', content}]
    pendingResponses: new Set(),  // AIs we're waiting for
    roundType: null  // 'initial', 'cross-eval', 'counter'
};

// Timer references for cleanup
let summaryInterval = null;
let summaryTimeout = null;

/**
 * Setup discussion mode event listeners
 */
export function setupDiscussionMode() {
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

/**
 * Switch between normal and discussion modes
 * @param {string} mode - 'normal' or 'discussion'
 */
export function switchMode(mode) {
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

/**
 * Validate that exactly 2 participants are selected
 */
function validateParticipants() {
    const selected = document.querySelectorAll('input[name="participant"]:checked');
    const startBtn = document.getElementById('start-discussion-btn');
    startBtn.disabled = selected.length !== 2;
}

/**
 * Start a new discussion
 */
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

/**
 * Handle a discussion response from an AI
 * @param {string} aiType - The AI that responded
 * @param {string} content - The response content
 */
export function handleDiscussionResponse(aiType, content) {
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

/**
 * Called when all responses for a round have been received
 */
function onRoundComplete() {
    log(`第 ${discussionState.currentRound} 輪完成`, 'success');
    updateDiscussionStatus('ready', `第 ${discussionState.currentRound} 輪完成，可以進入下一輪`);

    // Enable next round button
    document.getElementById('next-round-btn').disabled = false;
    document.getElementById('generate-summary-btn').disabled = false;
}

/**
 * Proceed to the next round of discussion
 */
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

/**
 * Handle user interjection during discussion
 */
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

/**
 * Generate discussion summary from both AIs
 */
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
    // 清除可能存在的舊 Timer
    if (summaryInterval) clearInterval(summaryInterval);
    if (summaryTimeout) clearTimeout(summaryTimeout);

    // 設置超時保護：最多等待 5 分鐘
    summaryInterval = setInterval(async () => {
        if (discussionState.pendingResponses.size === 0) {
            clearInterval(summaryInterval);
            clearTimeout(summaryTimeout);
            summaryInterval = null;
            summaryTimeout = null;

            // Get both summaries
            const summaries = discussionState.history.filter(h => h.type === 'summary');
            const ai1Summary = summaries.find(s => s.ai === ai1)?.content || '';
            const ai2Summary = summaries.find(s => s.ai === ai2)?.content || '';

            log(`[摘要] 雙方摘要已產生`, 'success');
            showSummary(ai1Summary, ai2Summary);
        }
    }, TIMEOUTS.SUMMARY_CHECK_INTERVAL);

    // 超時保護：5 分鐘後強制停止
    summaryTimeout = setTimeout(() => {
        clearInterval(summaryInterval);
        summaryInterval = null;
        summaryTimeout = null;
        log('[摘要] 超時：未在時限內收到回覆', 'error');
        updateDiscussionStatus('error', '摘要請求超時');
        document.getElementById('generate-summary-btn').disabled = false;
    }, TIMEOUTS.SUMMARY_WAIT);
}

/**
 * Display the discussion summary
 * @param {string} ai1Summary - Summary from first AI
 * @param {string} ai2Summary - Summary from second AI
 */
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

/**
 * End the current discussion
 */
function endDiscussion() {
    if (confirm('確定結束討論嗎？建議先產生摘要。')) {
        resetDiscussion();
    }
}

/**
 * Reset discussion state and UI
 */
function resetDiscussion() {
    // 清除所有進行中的 Timer
    if (summaryInterval) {
        clearInterval(summaryInterval);
        summaryInterval = null;
    }
    if (summaryTimeout) {
        clearTimeout(summaryTimeout);
        summaryTimeout = null;
    }

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

/**
 * Update the discussion status display
 * @param {string} state - Status state class
 * @param {string} text - Status text
 */
export function updateDiscussionStatus(state, text) {
    const statusEl = document.getElementById('discussion-status');
    statusEl.textContent = text;
    statusEl.className = 'discussion-status ' + state;
}
