/**
 * AI Roundtable - Utility Functions
 * 
 * Common utility functions used across modules.
 */

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} The escaped HTML string
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Insert text at current cursor position in an input element
 * @param {HTMLTextAreaElement|HTMLInputElement} input - The input element
 * @param {string} text - The text to insert
 */
export function insertTextAtCursor(input, text) {
    const cursorPos = input.selectionStart;
    const textBefore = input.value.substring(0, cursorPos);
    const textAfter = input.value.substring(cursorPos);

    // Add space before if needed
    const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ') && !textBefore.endsWith('\n');
    const insertText = (needsSpaceBefore ? ' ' : '') + text + ' ';

    input.value = textBefore + insertText + textAfter;
    input.focus();
    input.selectionStart = input.selectionEnd = cursorPos + insertText.length;
}
