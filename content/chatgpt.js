/**
 * AI Roundtable - ChatGPT Content Script
 * Original Author: Axton Liu (MIT License)
 * Modifications by: Wei Topaz (2026)
 */
// AI Panel - ChatGPT Content Script

(function () {
  'use strict';

  const AI_TYPE = 'chatgpt';

  // Capture timing configurations (in milliseconds)
  const CAPTURE_CONFIG = {
    MAX_WAIT: 120000,              // 2 minutes - maximum wait for response
    CHECK_INTERVAL: 500,           // 500ms - interval between stability checks
    STABLE_THRESHOLD: 6,           // 6 checks (3 seconds) of stable content (increased for reliability)
    STREAMING_CHECK_THRESHOLD: 3,  // 3 checks (1.5 seconds) - must see no streaming
    REACT_DELAY: 100,              // 100ms - delay for React state update
    BUTTON_WAIT: 2000,             // 2 seconds - max wait for button enabled
    BUTTON_CHECK_INTERVAL: 50      // 50ms - interval for button check
  };

  // Check if extension context is still valid
  function isContextValid() {
    return chrome.runtime && chrome.runtime.id;
  }

  // Safe message sender that checks context first
  function safeSendMessage(message, callback) {
    if (!isContextValid()) {
      console.log('[AI Panel] Extension context invalidated, skipping message');
      return;
    }
    try {
      chrome.runtime.sendMessage(message, callback);
    } catch (e) {
      console.log('[AI Panel] Failed to send message:', e.message);
    }
  }

  // Notify background that content script is ready
  safeSendMessage({ type: 'CONTENT_SCRIPT_READY', aiType: AI_TYPE });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INJECT_MESSAGE') {
      injectMessage(message.message)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.type === 'GET_LATEST_RESPONSE') {
      const response = getLatestResponse();
      sendResponse({ content: response });
      return true;
    }
  });

  // Response observer disabled - content is now read on-demand when buttons are pressed
  // setupResponseObserver();
  async function injectMessage(text) {
    // Use centralized selectors from AI_SELECTORS
    const inputSelectors = AI_SELECTORS.chatgpt.input;

    let inputEl = null;
    for (const selector of inputSelectors) {
      inputEl = document.querySelector(selector);
      if (inputEl) break;
    }

    if (!inputEl) {
      throw new Error('Could not find input field');
    }

    // Focus the input
    inputEl.focus();

    // Handle different input types
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Contenteditable div
      inputEl.textContent = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Small delay to let React process
    await sleep(CAPTURE_CONFIG.REACT_DELAY);

    // Find and click the send button
    const sendButton = findSendButton();
    if (!sendButton) {
      throw new Error('Could not find send button');
    }

    // Wait for button to be enabled
    await waitForButtonEnabled(sendButton);

    sendButton.click();

    // Start capturing response after sending
    console.log('[AI Panel] ChatGPT message sent, starting response capture...');
    waitForStreamingComplete();

    return true;
  }

  function findSendButton() {
    // Use centralized selectors from AI_SELECTORS
    const selectors = AI_SELECTORS.chatgpt.sendButton;

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        return el.closest('button') || el;
      }
    }

    // Fallback: find button near the input
    const form = document.querySelector(AI_SELECTORS.chatgpt.form);
    if (form) {
      const buttons = form.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.querySelector('svg') && isVisible(btn)) {
          return btn;
        }
      }
    }

    return null;
  }

  async function waitForButtonEnabled(button, maxWait = CAPTURE_CONFIG.BUTTON_WAIT) {
    const start = Date.now();
    while (button.disabled && Date.now() - start < maxWait) {
      await sleep(CAPTURE_CONFIG.BUTTON_CHECK_INTERVAL);
    }
  }

  function setupResponseObserver() {
    const observer = new MutationObserver((mutations) => {
      // Check context validity in observer callback
      if (!isContextValid()) {
        observer.disconnect();
        return;
      }
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              checkForResponse(node);
            }
          }
        }
      }
    });

    const startObserving = () => {
      if (!isContextValid()) return;
      const mainContent = document.querySelector(AI_SELECTORS.chatgpt.mainContent) || document.body;
      observer.observe(mainContent, {
        childList: true,
        subtree: true
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving);
    } else {
      startObserving();
    }
  }

  let lastCapturedContent = '';
  let isCapturing = false;

  function checkForResponse(node) {
    if (isCapturing) return;

    const responseSelectors = AI_SELECTORS.chatgpt.response.detection;

    for (const selector of responseSelectors) {
      if (node.matches?.(selector) || node.querySelector?.(selector)) {
        console.log('[AI Panel] ChatGPT detected new response...');
        waitForStreamingComplete();
        break;
      }
    }
  }

  // Check if ChatGPT is still streaming a response
  function isStreaming() {
    // Method 1: Check for stop button (most reliable)
    const stopButton = document.querySelector(AI_SELECTORS.chatgpt.streaming.stopButton);
    if (stopButton && isVisible(stopButton)) {
      return true;
    }

    // Method 2: Check for .result-streaming class on message
    const streamingElement = document.querySelector(AI_SELECTORS.chatgpt.streaming.streamingClass);
    if (streamingElement) {
      return true;
    }

    // Method 3: Check for writing/thinking indicators
    const writingBlock = document.querySelector(AI_SELECTORS.chatgpt.streaming.writingBlock);
    if (writingBlock) {
      return true;
    }

    // Method 4: Check for the pulsing cursor (typing indicator)
    const cursor = document.querySelector(AI_SELECTORS.chatgpt.streaming.cursor);
    if (cursor) {
      return true;
    }

    return false;
  }

  async function waitForStreamingComplete() {
    console.log('[AI Panel] ChatGPT waitForStreamingComplete called, isCapturing:', isCapturing);

    if (isCapturing) {
      console.log('[AI Panel] ChatGPT already capturing, skipping...');
      return;
    }
    isCapturing = true;
    console.log('[AI Panel] ChatGPT starting capture loop...');

    let previousContent = '';
    let stableCount = 0;

    const startTime = Date.now();
    let firstContentTime = null;  // Track when we first see content
    let noStreamingCount = 0;  // Track consecutive non-streaming checks

    try {
      while (Date.now() - startTime < CAPTURE_CONFIG.MAX_WAIT) {
        if (!isContextValid()) {
          console.log('[AI Panel] Context invalidated, stopping capture');
          return;
        }

        await sleep(CAPTURE_CONFIG.CHECK_INTERVAL);

        const currentContent = getLatestResponse() || '';
        const currentlyStreaming = isStreaming();

        // Track when content first appears
        if (currentContent.length > 0 && firstContentTime === null) {
          firstContentTime = Date.now();
          console.log('[AI Panel] ChatGPT first content detected, length:', currentContent.length);
        }

        // Track streaming state
        if (currentlyStreaming) {
          noStreamingCount = 0;
          stableCount = 0;  // Reset stable count if still streaming
        } else {
          noStreamingCount++;
        }

        // Debug: log every 10 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed % 10000 < CAPTURE_CONFIG.CHECK_INTERVAL) {
          console.log(`[AI Panel] ChatGPT check: contentLen=${currentContent.length}, stableCount=${stableCount}, streaming=${currentlyStreaming}, noStreamingCount=${noStreamingCount}, elapsed=${Math.round(elapsed / 1000)}s`);
        }

        // Content is stable when:
        // 1. Content unchanged
        // 2. Has content
        // 3. Not currently streaming (based on UI indicators)
        const contentStable = currentContent === previousContent &&
          currentContent.length > 0 &&
          noStreamingCount >= CAPTURE_CONFIG.STREAMING_CHECK_THRESHOLD;

        if (contentStable) {
          stableCount++;
          // Capture after stable checks pass AND streaming has stopped
          if (stableCount >= CAPTURE_CONFIG.STABLE_THRESHOLD) {
            if (currentContent !== lastCapturedContent) {
              lastCapturedContent = currentContent;
              console.log('[AI Panel] ChatGPT capturing response, length:', currentContent.length);
              safeSendMessage({
                type: 'RESPONSE_CAPTURED',
                aiType: AI_TYPE,
                content: currentContent
              });
              console.log('[AI Panel] ChatGPT response captured and sent!');
            } else {
              console.log('[AI Panel] ChatGPT content same as last capture, skipping');
            }
            return;
          }
        } else {
          stableCount = 0;
        }

        previousContent = currentContent;
      }
      console.log('[AI Panel] ChatGPT capture timeout after', maxWait / 1000, 'seconds');
    } finally {
      isCapturing = false;
      console.log('[AI Panel] ChatGPT capture loop ended');
    }
  }
  function getLatestResponse() {
    // Use centralized selectors from AI_SELECTORS
    const messageSelectors = AI_SELECTORS.chatgpt.response.messages;

    let messages = [];
    for (const selector of messageSelectors) {
      messages = document.querySelectorAll(selector);
      if (messages.length > 0) break;
    }

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Use innerText to preserve line breaks
      return lastMessage.innerText.trim();
    }

    return null;
  }

  // Utility functions
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0';
  }

  console.log('[AI Panel] ChatGPT content script loaded');
})();
