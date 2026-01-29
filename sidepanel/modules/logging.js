/**
 * AI Roundtable - Logging Module
 * 
 * Handles activity log and system log functionality.
 */

import { TIMEOUTS, LIMITS } from './config.js';
import { escapeHtml } from './utils.js';

// DOM Elements (will be set during initialization)
let logContainer = null;
let syslogContainer = null;

// System Log State - only starts recording when tab is first activated
let systemLogEnabled = false;

// Track current active log tab
let currentLogTab = 'activity';

/**
 * Initialize logging module with DOM containers
 * @param {HTMLElement} activityContainer - The activity log container
 * @param {HTMLElement} systemContainer - The system log container
 */
export function initLogging(activityContainer, systemContainer) {
    logContainer = activityContainer;
    syslogContainer = systemContainer;
}

/**
 * Log a message to the activity log
 * @param {string} message - The message to log
 * @param {string} type - Log type: 'info', 'success', 'error'
 */
export function log(message, type = 'info') {
    if (!logContainer) {
        console.warn('[Logging] Activity log container not initialized');
        return;
    }

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

    // Keep only last LOG_MAX_ENTRIES entries
    while (logContainer.children.length > LIMITS.LOG_MAX_ENTRIES) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

/**
 * System Log - Detailed logging for developers
 * @param {string} level - 'info' | 'debug' | 'warn' | 'error'
 * @param {string} source - Source module (e.g., 'panel', 'message', 'discussion')
 * @param {string} message - Log message
 * @param {object} context - Optional context data
 */
export function syslog(level, source, message, context = null) {
    // Only record if system log is enabled
    if (!systemLogEnabled) return;

    if (!syslogContainer) {
        console.warn('[Logging] System log container not initialized');
        return;
    }

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

    // Keep only last SYSLOG_MAX_ENTRIES entries (more than activity log for debugging)
    while (syslogContainer.children.length > LIMITS.SYSLOG_MAX_ENTRIES) {
        syslogContainer.removeChild(syslogContainer.lastChild);
    }
}

/**
 * Setup log tab switching and buttons
 */
export function setupLogTabs() {
    const tabActivity = document.getElementById('tab-activity');
    const tabSystem = document.getElementById('tab-system');

    tabActivity.addEventListener('click', () => switchLogTab('activity'));
    tabSystem.addEventListener('click', () => switchLogTab('system'));

    // Copy button
    document.getElementById('log-copy-btn').addEventListener('click', copyLogContent);

    // Clear button
    document.getElementById('log-clear-btn').addEventListener('click', clearLogContent);
}

/**
 * Switch between activity and system log tabs
 * @param {string} tab - 'activity' or 'system'
 */
export function switchLogTab(tab) {
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
        }, TIMEOUTS.FEEDBACK_DURATION);

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
    }, TIMEOUTS.FEEDBACK_DURATION);

    // Log the clear action (only to system log if we cleared activity log)
    if (currentLogTab === 'activity') {
        syslog('info', 'log', `已清除活動紀錄 (${entryCount} 筆)`);
    } else {
        // If clearing system log, we can still log to activity
        log(`已清除系統日誌 (${entryCount} 筆)`);
    }
}
