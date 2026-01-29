/**
 * AI Roundtable - Normal Mode Module
 * 
 * Handles normal (non-discussion) mode functionality including
 * sending messages and action selection.
 */

import { AI_TYPES, CROSS_REF_ACTIONS } from './config.js';
import { log, syslog } from './logging.js';
import { parseMessage, sendToAI, handleCrossReference } from './messaging.js';
import {
    handleMutualReview,
    handleMutualFromMenu,
    openSourceModal,
    setupModalListeners
} from './evaluation.js';

// Reference to DOM elements (set during initialization)
let messageInput = null;
let sendBtn = null;

/**
 * Initialize normal mode
 * @param {HTMLTextAreaElement} inputElement - The message input element
 * @param {HTMLButtonElement} sendButton - The send button element
 */
export function initNormalMode(inputElement, sendButton) {
    messageInput = inputElement;
    sendBtn = sendButton;
}

/**
 * Setup event listeners for normal mode
 */
export function setupNormalMode() {
    if (!messageInput || !sendBtn) {
        console.error('[NormalMode] Not initialized. Call initNormalMode first.');
        return;
    }

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
    const actionSelect = document.getElementById('action-select');
    if (actionSelect) {
        actionSelect.addEventListener('change', handleActionSelect);
    }

    // Modal event listeners
    setupModalListeners();
}

/**
 * Handle action select dropdown change
 * @param {Event} e - The change event
 */
function handleActionSelect(e) {
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
}

/**
 * Handle send button click
 */
export async function handleSend() {
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
