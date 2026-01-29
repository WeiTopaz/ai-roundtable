/**
 * AI Roundtable - Evaluation Module
 * 
 * Handles mutual review and directed evaluation functionality.
 */

import { AI_TYPES, TONE_PROMPTS } from './config.js';
import { capitalize } from './utils.js';
import { log } from './logging.js';
import { getLatestResponse, sendToAI } from './messaging.js';

// Pending action state for modal flow
let pendingAction = null;

// Reference to message input (set during initialization)
let messageInput = null;

/**
 * Initialize evaluation module
 * @param {HTMLTextAreaElement} inputElement - The message input element
 */
export function initEvaluation(inputElement) {
    messageInput = inputElement;
}

/**
 * Handle mutual review (all selected AIs evaluate each other)
 * @param {string[]} participants - Array of AI types participating
 * @param {string} prompt - The evaluation prompt
 */
export async function handleMutualReview(participants, prompt) {
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

/**
 * Handle mutual evaluation triggered from menu (using checkbox-selected AIs)
 */
export async function handleMutualFromMenu() {
    const targets = AI_TYPES.filter(ai => {
        const checkbox = document.getElementById(`target-${ai}`);
        return checkbox && checkbox.checked;
    });

    if (targets.length < 2) {
        log('互評需要至少選取 2 個 AI', 'error');
        return;
    }

    const additionalPrompt = messageInput ? messageInput.value.trim() : '';
    const prompt = additionalPrompt || '請評價以上觀點。你同意什麼？不同意什麼？有什麼補充？';

    log(`[互評] ${targets.join(', ')}`);
    if (messageInput) messageInput.value = '';

    await handleMutualReview(targets, prompt);
}

/**
 * Open source selection modal
 * @param {string|null} evaluator - The AI that will do the evaluation (null for advanced mode)
 * @param {string} mode - 'single' (one evaluator) or 'advanced' (multiple evaluators)
 */
export function openSourceModal(evaluator, mode) {
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
export function setupModalListeners() {
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
export async function handleDirectedEvaluation(evaluator, sources, tone = 'general') {
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
    const additionalPrompt = messageInput ? messageInput.value.trim() : '';
    const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.general;
    const prompt = additionalPrompt ? `${tonePrompt}\n\n${additionalPrompt}` : tonePrompt;

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
    if (messageInput) messageInput.value = '';

    // Send to evaluator
    await sendToAI(evaluator, fullMessage);

    log(`[單向評價] 完成！已傳送 ${sources.length} 個回覆給 ${capitalize(evaluator)}`, 'success');
}
