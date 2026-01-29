/**
 * AI Roundtable - Configuration Constants
 * 
 * Centralized configuration for the sidepanel.
 */

// Supported AI types
export const AI_TYPES = ['claude', 'chatgpt', 'gemini'];

// Timeout configurations (in milliseconds)
export const TIMEOUTS = {
    GET_RESPONSE: 10000,    // 10 seconds for getting AI response
    SEND_MESSAGE: 15000,    // 15 seconds for sending message
    SUMMARY_WAIT: 300000,   // 5 minutes for summary generation
    SUMMARY_CHECK_INTERVAL: 500,  // 500ms interval for checking summary completion
    FEEDBACK_DURATION: 1000 // 1 second for button feedback (Copy/Clear)
};

// Limits configurations
export const LIMITS = {
    LOG_MAX_ENTRIES: 50,      // Maximum activity log entries
    SYSLOG_MAX_ENTRIES: 500   // Maximum system log entries
};

// Cross-reference action keywords
export const CROSS_REF_ACTIONS = {
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
export const TONE_PROMPTS = {
    general: '請綜合評價以上觀點。你同意什麼？不同意什麼？有什麼補充？',
    pros: '請指出以上回覆中值得學習的優點與亮點。',
    cons: '請指出以上回覆中的問題、不足或可改進之處。',
    add: '請補充以上回覆中遺漏的內容或重要考量。',
    compare: '請對比以上觀點與你的看法，分析異同。'
};

// Command prefixes for message parsing
export const COMMANDS = {
    MUTUAL: '/mutual',
    CROSS: '/cross'
};
