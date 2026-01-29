/**
 * AI Roundtable - Connection Management Module
 * 
 * Handles tab connection status and AI type detection.
 */

import { AI_TYPES } from './config.js';

// Track connected tabs
export const connectedTabs = {
    claude: null,
    chatgpt: null,
    gemini: null
};

/**
 * Check all open tabs for AI platforms and update connection status
 */
export async function checkConnectedTabs() {
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
        console.error('檢查分頁時發生錯誤:', err.message);
    }
}

/**
 * Determine AI type from URL
 * @param {string} url - The tab URL
 * @returns {string|null} The AI type or null
 */
export function getAITypeFromUrl(url) {
    if (!url) return null;
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('gemini.google.com')) return 'gemini';
    return null;
}

/**
 * Update the UI to reflect tab connection status
 * @param {string} aiType - The AI type
 * @param {boolean} connected - Whether the AI is connected
 */
export function updateTabStatus(aiType, connected) {
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
