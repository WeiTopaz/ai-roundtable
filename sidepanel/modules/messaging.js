/**
 * AI Roundtable - Messaging Module
 * 
 * Handles message parsing, sending, and cross-reference logic.
 */

import { TIMEOUTS } from './config.js';
import { log, syslog } from './logging.js';

/**
 * Check if Prompt Repetition is enabled
 * Checks both normal mode and discussion mode checkboxes
 * @returns {boolean} Whether prompt repetition is enabled
 */
export function isPromptRepetitionEnabled() {
    const normalModeCheckbox = document.getElementById('prompt-repetition');
    const discussionModeCheckbox = document.getElementById('prompt-repetition-discussion');

    // Check which mode is active and return the corresponding checkbox state
    const discussionMode = document.getElementById('discussion-mode');
    if (discussionMode && !discussionMode.classList.contains('hidden')) {
        return discussionModeCheckbox?.checked || false;
    }
    return normalModeCheckbox?.checked || false;
}

/**
 * Parse a message for @ mentions and special commands
 * @param {string} message - The message to parse
 * @returns {object} Parsed message details
 */
export function parseMessage(message) {
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

/**
 * Get the latest response from an AI
 * @param {string} aiType - The AI type ('claude', 'chatgpt', 'gemini')
 * @param {number} timeoutMs - Optional timeout in milliseconds (default: TIMEOUTS.GET_RESPONSE)
 * @returns {Promise<string|null>} The AI response content or null
 */
export async function getLatestResponse(aiType, timeoutMs = TIMEOUTS.GET_RESPONSE) {
    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            syslog('warn', 'response', `取得回覆超時: ${aiType}`, { timeout: timeoutMs });
            resolve(null);  // Resolve with null on timeout to allow graceful degradation
        }, timeoutMs);

        try {
            chrome.runtime.sendMessage(
                { type: 'GET_RESPONSE', aiType },
                (response) => {
                    clearTimeout(timeoutId);

                    // Check for Chrome runtime errors
                    if (chrome.runtime.lastError) {
                        syslog('error', 'response', `Runtime error: ${chrome.runtime.lastError.message}`, { aiType });
                        resolve(null);
                        return;
                    }

                    resolve(response?.content || null);
                }
            );
        } catch (err) {
            clearTimeout(timeoutId);
            syslog('error', 'response', `取得回覆異常: ${aiType}`, { error: err.message });
            resolve(null);
        }
    });
}

/**
 * Send a message to an AI
 * @param {string} aiType - The AI type ('claude', 'chatgpt', 'gemini')
 * @param {string} message - The message to send
 * @param {number} timeoutMs - Optional timeout in milliseconds (default: TIMEOUTS.SEND_MESSAGE)
 * @returns {Promise<{success: boolean, error?: string}>} Result object
 */
export async function sendToAI(aiType, message, timeoutMs = TIMEOUTS.SEND_MESSAGE) {
    // Apply prompt repetition if enabled
    let finalMessage = message;
    if (isPromptRepetitionEnabled()) {
        finalMessage = message + '\n\n---\n\n' + message;
        syslog('debug', 'send', `Prompt Repetition enabled, duplicating message`);
    }

    syslog('debug', 'send', `準備傳送訊息至 ${aiType}`, { messageLength: finalMessage.length });

    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            log(`傳送至 ${aiType} 超時`, 'error');
            syslog('warn', 'send', `傳送訊息超時: ${aiType}`, { timeout: timeoutMs });
            resolve({ success: false, error: '請求超時' });
        }, timeoutMs);

        try {
            chrome.runtime.sendMessage(
                { type: 'SEND_MESSAGE', aiType, message: finalMessage },
                (response) => {
                    clearTimeout(timeoutId);

                    // Check for Chrome runtime errors
                    if (chrome.runtime.lastError) {
                        const errorMsg = chrome.runtime.lastError.message;
                        log(`傳送至 ${aiType} 失敗: ${errorMsg}`, 'error');
                        syslog('error', 'send', `Runtime error: ${errorMsg}`, { aiType });
                        resolve({ success: false, error: errorMsg });
                        return;
                    }

                    if (response?.success) {
                        log(`已傳送至 ${aiType}`, 'success');
                        syslog('info', 'send', `訊息已傳送至 ${aiType}`, { messageLength: finalMessage.length });
                    } else {
                        log(`傳送至 ${aiType} 失敗: ${response?.error || '未知錯誤'}`, 'error');
                        syslog('error', 'send', `傳送失敗: ${aiType}`, { error: response?.error });
                    }
                    resolve(response || { success: false, error: '無回應' });
                }
            );
        } catch (err) {
            clearTimeout(timeoutId);
            log(`傳送至 ${aiType} 異常: ${err.message}`, 'error');
            syslog('error', 'send', `傳送異常: ${aiType}`, { error: err.message });
            resolve({ success: false, error: err.message });
        }
    });
}

/**
 * Handle cross-reference between AIs
 * @param {object} parsed - The parsed message object
 */
export async function handleCrossReference(parsed) {
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
