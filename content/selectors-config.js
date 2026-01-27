/**
 * AI Roundtable - DOM Selectors Configuration
 * 
 * Centralized configuration file for all DOM selectors used by content scripts.
 * When AI platforms update their UI, only this file needs to be modified.
 * 
 * Original Author: Axton Liu (MIT License)
 * Modifications by: Wei Topaz (2026)
 */

// eslint-disable-next-line no-unused-vars
const AI_SELECTORS = {
    // ============================================
    // Claude Selectors
    // ============================================
    claude: {
        // Input field selectors (priority order)
        input: [
            'div[contenteditable="true"].ProseMirror',
            'div.ProseMirror[contenteditable="true"]',
            '[data-placeholder="How can Claude help you today?"]',
            'fieldset div[contenteditable="true"]'
        ],

        // Send button selectors (priority order)
        sendButton: [
            'button[aria-label="Send message"]',
            'button[aria-label="Send Message"]',
            'button[type="submit"]',
            'fieldset button:last-of-type',
            'button svg[viewBox]'  // Button containing an SVG
        ],

        // Response detection selectors
        response: {
            // Container for checking if streaming is complete
            container: '[data-is-streaming="false"]',
            // Content blocks within response
            content: '.standard-markdown',
            // Selectors for response detection in observer
            detection: [
                '[data-is-streaming]',
                '.font-claude-message',
                '[class*="response"]'
            ],
            // Elements to filter out (thinking blocks)
            thinkingFilter: {
                container: '[class*="overflow-hidden"][class*="max-h-"]',
                parent: '.font-claude-response',
                buttonText: ['Thought process', '思考過程']
            }
        },

        // Streaming status indicators
        streaming: {
            active: '[data-is-streaming="true"]',
            stopButton: 'button[aria-label*="Stop"]'
        },

        // Main content area for observer
        mainContent: 'main'
    },

    // ============================================
    // ChatGPT Selectors
    // ============================================
    chatgpt: {
        // Input field selectors (priority order)
        input: [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'div[contenteditable="true"][data-placeholder]',
            'textarea[placeholder*="Message"]',
            'textarea'
        ],

        // Send button selectors (priority order)
        sendButton: [
            'button[data-testid="send-button"]',
            'button[aria-label="Send prompt"]',
            'button[aria-label="Send message"]',
            'form button[type="submit"]',
            'button svg path[d*="M15.192"]'  // Arrow icon path
        ],

        // Response detection selectors
        response: {
            // Message selectors for extracting content (priority order)
            messages: [
                '[data-message-author-role="assistant"] .markdown',
                '[data-message-author-role="assistant"] [class*="markdown"]',
                '[data-message-author-role="assistant"]',
                '.agent-turn .markdown',
                '[class*="agent-turn"] .markdown',
                '[data-testid*="conversation-turn"]:has([data-message-author-role="assistant"]) .markdown',
                '[data-testid*="conversation-turn"] .markdown',
                'article[data-testid*="conversation"] .markdown'
            ],
            // Selectors for response detection in observer
            detection: [
                '[data-message-author-role="assistant"]',
                '.agent-turn',
                '[class*="assistant"]'
            ]
        },

        // Streaming status indicators
        streaming: {
            stopButton: 'button[aria-label*="Stop"], button[aria-label*="停止"], button[data-testid="stop-button"]',
            streamingClass: '.result-streaming',
            writingBlock: '[data-writing-block]',
            cursor: '[class*="result-streaming"] span:last-child'
        },

        // Main content area for observer
        mainContent: 'main',

        // Form container for fallback button search
        form: 'form'
    },

    // ============================================
    // Gemini Selectors
    // ============================================
    gemini: {
        // Input field selectors (priority order)
        input: [
            '.ql-editor',
            'div[contenteditable="true"]',
            'rich-textarea textarea',
            'textarea[aria-label*="prompt"]',
            'textarea[placeholder*="Enter"]',
            '.input-area textarea',
            'textarea'
        ],

        // Send button selectors (priority order)
        sendButton: [
            'button[aria-label*="Send"]',
            'button[aria-label*="submit"]',
            'button.send-button',
            'button[data-test-id="send-button"]',
            '.input-area button',
            'button mat-icon[data-mat-icon-name="send"]'
        ],

        // Response detection selectors
        response: {
            // Primary response content selector
            content: '.model-response-text',
            // Fallback selector
            fallback: 'message-content',
            // Selectors for response detection in observer
            detection: '.model-response-text, message-content'
        },

        // Streaming status indicators (Gemini uses content stability check)
        streaming: {
            // Gemini doesn't have reliable streaming indicators
            // Content stability is used instead
        },

        // Main content area for observer
        mainContent: 'main, .conversation-container',

        // Button fallback search keywords
        buttonKeywords: {
            text: ['send', 'submit'],
            ariaLabel: ['send', 'submit']
        }
    }
};

// Freeze the configuration to prevent accidental modifications
if (typeof Object.freeze === 'function') {
    Object.freeze(AI_SELECTORS);
    Object.freeze(AI_SELECTORS.claude);
    Object.freeze(AI_SELECTORS.chatgpt);
    Object.freeze(AI_SELECTORS.gemini);
}
