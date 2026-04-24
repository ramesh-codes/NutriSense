/**
 * NutriSense — app.js
 * ============================================================
 * Client-side application logic for the NutriSense AI dietary
 * consultant. All Gemini API calls originate from this file,
 * running entirely in the user's browser.
 *
 * SECURITY MODEL (Zero-Trust):
 *   - The API key is stored in a JavaScript module-scoped
 *     variable and read directly from the DOM input field at
 *     call time. It is NEVER sent to the NutriSense server
 *     (server.js only serves static files).
 *   - Calls go directly:  Browser → api.generativeai.google.com
 *
 * MODULES (IIFE-scoped to avoid polluting global scope):
 *   1. Config          — constants & Gemini endpoint builder
 *   2. State           — single source of truth for app state
 *   3. DOM             — cached element references
 *   4. UIUtils         — generic UI helpers (show/hide, toast)
 *   5. ApiKeyManager   — key input, visibility toggle, validation
 *   6. CharCounter     — live character count on textarea
 *   7. QuickPrompts    — chip button handler
 *   8. GeminiService   — constructs prompt & calls Gemini API
 *   9. ResponseRenderer— formats & renders markdown-like text
 *  10. HistoryManager  — session history (in-memory)
 *  11. App             — wires everything together
 * ============================================================
 */

'use strict';

(function NutriSenseApp() {

  /* ══════════════════════════════════════════════════════════
     1. CONFIG
     ══════════════════════════════════════════════════════════ */
  const Config = {
    /** Gemini model to use — flash is fastest & cheapest */
    MODEL: 'gemini-2.5-flash',

    /** Max history items to retain per session */
    MAX_HISTORY: 10,

    /** Max characters allowed in food input */
    MAX_CHARS: 1000,

    /** Char count thresholds for colour warning */
    WARN_THRESHOLD:   800,
    DANGER_THRESHOLD: 950,

    /** Toast display duration (ms) */
    TOAST_DURATION: 3000,

    /**
     * Constructs the Gemini REST endpoint URL.
     * @param {string} apiKey - User's Gemini API key
     * @returns {string} Full URL with key as query param
     */
    geminiEndpoint(apiKey) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    },

    /**
     * The system prompt that gives Gemini its persona.
     * Emphasises empathy, harm-reduction, and actionable advice.
     */
    SYSTEM_PROMPT: `You are NutriSense, a warm, empathetic, and non-judgmental AI dietary consultant.

Your core philosophy is HARM REDUCTION — never shame the user for their choices.
Your goal is to gently guide them toward healthier habits through education and
practical, realistic alternatives that fit into real life.

When a user describes what they ate or what they are craving, you MUST:

1. **Acknowledge & Validate** (1-2 sentences): Recognise their feelings or choice without judgement.

2. **Nutritional Overview** (bullet points): Briefly explain the nutritional profile — what's good, what's less ideal, in plain language. Avoid medical jargon.

3. **Smart Substitutions** (bullet points, at least 3): Suggest specific, achievable healthier alternatives or swaps. Be practical — suggest things found in a normal supermarket.

4. **Harm-Reduction Tips** (bullet points, at least 2): If they chose the less-healthy option anyway, how can they reduce the negative impact? (e.g., portion size, timing, pairing with other foods, hydration).

5. **One Encouraging Takeaway** (1 sentence): End with a positive, motivating message.

Format your response using clear sections with bold headers (using **Header:** syntax).
Keep the total response under 400 words. Be conversational, warm, and supportive — like a knowledgeable friend, not a doctor.`,
  };

  /* ══════════════════════════════════════════════════════════
     2. STATE
     ══════════════════════════════════════════════════════════ */
  const State = {
    /** Whether a fetch is currently in progress */
    isLoading: false,

    /**
     * Session query history (not persisted to localStorage —
     * stays in memory only for privacy).
     * @type {Array<{query: string, timestamp: Date}>}
     */
    history: [],
  };

  /* ══════════════════════════════════════════════════════════
     3. DOM — Cached element references
     ══════════════════════════════════════════════════════════ */
  const DOM = {
    apiKeyInput:       document.getElementById('api-key-input'),
    toggleKeyBtn:      document.getElementById('toggle-key-visibility'),
    eyeIcon:           document.getElementById('eye-icon'),
    foodInput:         document.getElementById('food-input'),
    charCounter:       document.getElementById('char-counter'),
    analyzeBtn:        document.getElementById('analyze-btn'),
    responseSection:   document.getElementById('response-section'),
    loadingIndicator:  document.getElementById('loading-indicator'),
    errorBanner:       document.getElementById('error-banner'),
    errorMessage:      document.getElementById('error-message'),
    responseContent:   document.getElementById('response-content'),
    copyBtn:           document.getElementById('copy-btn'),
    historySection:    document.getElementById('history-section'),
    historyList:       document.getElementById('history-list'),
    clearHistoryBtn:   document.getElementById('clear-history-btn'),
    toast:             document.getElementById('toast'),
    quickChips:        document.querySelectorAll('.chip'),
  };

  /* ══════════════════════════════════════════════════════════
     4. UI UTILS — Generic helpers
     ══════════════════════════════════════════════════════════ */
  const UIUtils = {
    /**
     * Shows an element by removing the `hidden` attribute.
     * @param {HTMLElement} el
     */
    show(el) {
      el.removeAttribute('hidden');
    },

    /**
     * Hides an element by setting the `hidden` attribute.
     * @param {HTMLElement} el
     */
    hide(el) {
      el.setAttribute('hidden', '');
    },

    /**
     * Displays a transient toast notification.
     * @param {string} message - Text to display
     * @param {'info'|'success'|'error'} [type='info']
     */
    showToast(message, type = 'info') {
      const { toast } = DOM;
      const icons = { info: 'ℹ️', success: '✅', error: '❌' };
      toast.textContent = `${icons[type] ?? ''} ${message}`;
      UIUtils.show(toast);

      // Auto-dismiss after configured duration
      clearTimeout(UIUtils._toastTimer);
      UIUtils._toastTimer = setTimeout(() => {
        UIUtils.hide(toast);
      }, Config.TOAST_DURATION);
    },

    /** Internal timer reference for toast auto-dismiss */
    _toastTimer: null,

    /**
     * Sets the loading state across the UI.
     * Disables the analyze button and shows/hides the spinner.
     * @param {boolean} isLoading
     */
    setLoading(isLoading) {
      State.isLoading = isLoading;
      DOM.analyzeBtn.disabled = isLoading;

      if (isLoading) {
        UIUtils.show(DOM.loadingIndicator);
        UIUtils.hide(DOM.responseContent);
        UIUtils.hide(DOM.errorBanner);
        UIUtils.show(DOM.responseSection);
      } else {
        UIUtils.hide(DOM.loadingIndicator);
      }
    },
  };

  /* ══════════════════════════════════════════════════════════
     5. API KEY MANAGER
     ══════════════════════════════════════════════════════════ */
  const ApiKeyManager = {
    /**
     * Retrieves the trimmed API key from the input field.
     * @returns {string}
     */
    getKey() {
      return DOM.apiKeyInput.value.trim();
    },

    /**
     * Validates that a key is present and looks plausible.
     * Gemini keys start with "AIza" and are 39 chars long.
     * @returns {{ valid: boolean, error?: string }}
     */
    validate() {
      const key = ApiKeyManager.getKey();

      if (!key) {
        return { valid: false, error: 'Please enter your Gemini API key in the sidebar before analysing.' };
      }
      if (!key.startsWith('AIza') || key.length < 30) {
        return { valid: false, error: 'This doesn\'t look like a valid Gemini API key. Keys start with "AIza". Please check and try again.' };
      }
      return { valid: true };
    },

    /** Toggles the API key input between password and text type */
    toggleVisibility() {
      const isPassword = DOM.apiKeyInput.type === 'password';
      DOM.apiKeyInput.type = isPassword ? 'text' : 'password';
      DOM.eyeIcon.textContent = isPassword ? '🙈' : '👁️';
      DOM.toggleKeyBtn.setAttribute(
        'aria-label',
        isPassword ? 'Hide API key' : 'Show API key'
      );
    },
  };

  /* ══════════════════════════════════════════════════════════
     6. CHAR COUNTER
     ══════════════════════════════════════════════════════════ */
  const CharCounter = {
    /** Updates the live character counter below the textarea */
    update() {
      const len = DOM.foodInput.value.length;
      DOM.charCounter.textContent = `${len} / ${Config.MAX_CHARS}`;

      // Colour feedback for accessibility
      DOM.charCounter.classList.remove('is-warning', 'is-danger');
      if (len >= Config.DANGER_THRESHOLD) {
        DOM.charCounter.classList.add('is-danger');
      } else if (len >= Config.WARN_THRESHOLD) {
        DOM.charCounter.classList.add('is-warning');
      }
    },
  };

  /* ══════════════════════════════════════════════════════════
     7. QUICK PROMPTS
     ══════════════════════════════════════════════════════════ */
  const QuickPrompts = {
    /**
     * Handles a chip click: injects the chip's data-prompt
     * value into the textarea and updates the char counter.
     * @param {MouseEvent} event
     */
    handleClick(event) {
      const chip = event.currentTarget;
      const prompt = chip.dataset.prompt;
      if (!prompt) return;

      DOM.foodInput.value = prompt;
      CharCounter.update();
      DOM.foodInput.focus();
      // Scroll textarea into view on mobile
      DOM.foodInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
  };

  /* ══════════════════════════════════════════════════════════
     8. GEMINI SERVICE
     ══════════════════════════════════════════════════════════ */
  const GeminiService = {
    /**
     * Builds the JSON request body for the Gemini API.
     * Uses a two-message structure: system context + user turn.
     * @param {string} userInput - The user's food description
     * @returns {object} Gemini API request body
     */
    buildRequestBody(userInput) {
      return {
        // System instruction sets the model persona
        system_instruction: {
          parts: [{ text: Config.SYSTEM_PROMPT }],
        },
        // User message is the actual food query
        contents: [
          {
            role: 'user',
            parts: [{ text: userInput }],
          },
        ],
        // Generation config for consistent, safe responses
        generationConfig: {
          temperature:     0.75,  // Balanced creativity & accuracy
          topP:            0.9,
          topK:            40,
          maxOutputTokens: 1024,
        },
        // Safety settings — keep responses family-friendly
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      };
    },

    /**
     * Sends the food query to the Gemini API and returns
     * the generated text content.
     *
     * SECURITY: The API key is embedded in the URL only at
     * call time and goes directly to Google's servers.
     * The NutriSense Express server never sees it.
     *
     * @param {string} apiKey   - User's Gemini API key
     * @param {string} userInput - The food description
     * @returns {Promise<string>} - The AI's response text
     * @throws {Error} With a user-friendly message on failure
     */
    async query(apiKey, userInput) {
      const endpoint = Config.geminiEndpoint(apiKey);
      const body     = GeminiService.buildRequestBody(userInput);

      let response;
      try {
        response = await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
      } catch (networkError) {
        // Network failure (offline, CORS, DNS, etc.)
        throw new Error(
          'Could not reach the Gemini API. Please check your internet connection and try again.'
        );
      }

      // Parse JSON regardless of status to extract error details
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`Unexpected response from Gemini API (HTTP ${response.status}).`);
      }

      // Handle HTTP error codes with specific messages
      if (!response.ok) {
        const apiError = data?.error;
        const status   = response.status;

        if (status === 400) {
          throw new Error(
            'Bad request sent to Gemini. Your input may contain unsupported characters. Please try rephrasing.'
          );
        }
        if (status === 401 || status === 403) {
          throw new Error(
            '🔑 Invalid or unauthorised API key. Please double-check your key in the sidebar and try again.'
          );
        }
        if (status === 429) {
          throw new Error(
            '⏳ You\'ve hit the Gemini API rate limit. Please wait a moment and try again.'
          );
        }
        if (status >= 500) {
          throw new Error(
            `Gemini API server error (${status}). Google's servers may be temporarily unavailable. Please try again shortly.`
          );
        }

        // Fallback: surface whatever Google returned
        throw new Error(
          apiError?.message ?? `Gemini API error (HTTP ${status}). Please try again.`
        );
      }

      // Validate response structure
      const candidate = data?.candidates?.[0];

      if (!candidate) {
        throw new Error('Gemini returned an empty response. Please try again with a different description.');
      }

      // Handle content filtering blocks
      if (candidate.finishReason === 'SAFETY') {
        throw new Error(
          'Your input was flagged by Gemini\'s safety filters. Please rephrase your query.'
        );
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini returned a response with no text content. Please try again.');
      }

      return text;
    },
  };

  /* ══════════════════════════════════════════════════════════
     9. RESPONSE RENDERER
     ══════════════════════════════════════════════════════════ */
  const ResponseRenderer = {
    /**
     * Converts the AI's plain-text markdown-like response into
     * safe HTML for display. Supports:
     *   - **bold** → <strong>
     *   - Bullet lines starting with * or - → <li>
     *   - Blank lines → paragraph breaks
     *
     * Uses textContent for untrusted segments to prevent XSS.
     * @param {string} rawText - The Gemini response string
     * @returns {string} Safe HTML string
     */
    format(rawText) {
      // Escape a string to prevent XSS when inserting as HTML
      const escape = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      // Process bold: **text** → <strong>text</strong>
      const processBold = (line) =>
        escape(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      const lines  = rawText.split('\n');
      const output = [];
      let inList   = false;

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        // Bullet list item
        if (/^[\*\-]\s+/.test(line)) {
          if (!inList) {
            output.push('<ul class="response-list">');
            inList = true;
          }
          const content = line.replace(/^[\*\-]\s+/, '');
          output.push(`<li>${processBold(content)}</li>`);
          continue;
        }

        // Close list if we were in one
        if (inList) {
          output.push('</ul>');
          inList = false;
        }

        // Empty line = paragraph break
        if (line.trim() === '') {
          output.push('<br>');
          continue;
        }

        // Regular line (could be a header like "**Header:**")
        output.push(`<p>${processBold(line)}</p>`);
      }

      if (inList) output.push('</ul>');

      return output.join('\n');
    },

    /**
     * Renders a formatted response into the response card.
     * @param {string} rawText
     */
    render(rawText) {
      DOM.responseContent.innerHTML = ResponseRenderer.format(rawText);
      UIUtils.show(DOM.responseContent);
    },
  };

  /* ══════════════════════════════════════════════════════════
     10. HISTORY MANAGER
     ══════════════════════════════════════════════════════════ */
  const HistoryManager = {
    /**
     * Adds a query to the in-memory session history and
     * re-renders the history list.
     * @param {string} query
     */
    add(query) {
      // Prepend newest first; cap at MAX_HISTORY
      State.history.unshift({ query, timestamp: new Date() });
      if (State.history.length > Config.MAX_HISTORY) {
        State.history.pop();
      }
      HistoryManager.render();
    },

    /** Clears all session history */
    clear() {
      State.history = [];
      HistoryManager.render();
    },

    /**
     * Re-renders the history list from State.history.
     * Shows/hides the history section as appropriate.
     */
    render() {
      const { history } = State;

      if (history.length === 0) {
        UIUtils.hide(DOM.historySection);
        return;
      }

      UIUtils.show(DOM.historySection);
      DOM.historyList.innerHTML = '';

      history.forEach(({ query, timestamp }) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        li.setAttribute('aria-label', `Reload query: ${query.slice(0, 60)}`);

        // Truncate long queries for display
        const displayText = query.length > 80 ? query.slice(0, 77) + '…' : query;

        // Format time as HH:MM
        const timeStr = timestamp.toLocaleTimeString([], {
          hour:   '2-digit',
          minute: '2-digit',
        });

        li.innerHTML = `
          <span class="history-item-text" title="${query.replace(/"/g, '&quot;')}">${displayText}</span>
          <span class="history-item-time" aria-label="at ${timeStr}">${timeStr}</span>
        `;

        // Click or Enter → re-populate textarea
        const loadQuery = () => {
          DOM.foodInput.value = query;
          CharCounter.update();
          DOM.foodInput.focus();
          DOM.foodInput.scrollIntoView({ behavior: 'smooth' });
        };

        li.addEventListener('click', loadQuery);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            loadQuery();
          }
        });

        DOM.historyList.appendChild(li);
      });
    },
  };

  /* ══════════════════════════════════════════════════════════
     11. APP — Main controller: wires modules together
     ══════════════════════════════════════════════════════════ */
  const App = {
    /**
     * Primary action: validate inputs, call Gemini, render result.
     * Called when the user clicks "Analyze My Meal".
     */
    async handleAnalyze() {
      // Guard: prevent concurrent requests
      if (State.isLoading) return;

      // ── Validate API Key ──────────────────────────────────
      const keyValidation = ApiKeyManager.validate();
      if (!keyValidation.valid) {
        App.showError(keyValidation.error);
        DOM.apiKeyInput.focus();
        return;
      }

      // ── Validate Food Input ───────────────────────────────
      const userInput = DOM.foodInput.value.trim();
      if (!userInput) {
        App.showError('Please describe what you ate or what you are craving before analysing.');
        DOM.foodInput.focus();
        return;
      }

      if (userInput.length > Config.MAX_CHARS) {
        App.showError(`Your input is too long. Please keep it under ${Config.MAX_CHARS} characters.`);
        return;
      }

      // ── Start Loading ─────────────────────────────────────
      UIUtils.setLoading(true);

      try {
        const apiKey = ApiKeyManager.getKey();
        const responseText = await GeminiService.query(apiKey, userInput);

        // Render the successful response
        ResponseRenderer.render(responseText);
        UIUtils.hide(DOM.errorBanner);

        // Add to session history
        HistoryManager.add(userInput);

        // Smooth scroll to response
        DOM.responseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      } catch (error) {
        // Surface all errors (network, auth, rate-limit, etc.)
        App.showError(error.message);
        console.error('[NutriSense] Gemini API Error:', error);
      } finally {
        // Always stop loading spinner
        UIUtils.setLoading(false);
      }
    },

    /**
     * Displays an error in the response section.
     * Uses aria-live="assertive" to announce to screen readers.
     * @param {string} message
     */
    showError(message) {
      UIUtils.show(DOM.responseSection);
      UIUtils.hide(DOM.responseContent);
      UIUtils.hide(DOM.loadingIndicator);
      DOM.errorMessage.textContent = message;
      UIUtils.show(DOM.errorBanner);
    },

    /**
     * Copies the current response text to the clipboard.
     * Falls back gracefully if Clipboard API is unavailable.
     */
    async handleCopy() {
      const text = DOM.responseContent.innerText;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        UIUtils.showToast('Response copied to clipboard!', 'success');
      } catch {
        // Clipboard API failed (e.g., HTTP, permissions denied)
        UIUtils.showToast('Could not copy — please select and copy manually.', 'error');
      }
    },

    /**
     * Registers all DOM event listeners.
     * Called once on DOMContentLoaded.
     */
    bindEvents() {
      // ── API Key Toggle ────────────────────────────────────
      DOM.toggleKeyBtn.addEventListener('click', ApiKeyManager.toggleVisibility);

      // ── Char counter — update on every keystroke ──────────
      DOM.foodInput.addEventListener('input', CharCounter.update);

      // ── Analyze button ────────────────────────────────────
      DOM.analyzeBtn.addEventListener('click', App.handleAnalyze);

      // ── Keyboard shortcut: Ctrl+Enter / Cmd+Enter submits ─
      DOM.foodInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          App.handleAnalyze();
        }
      });

      // ── Quick-prompt chips ────────────────────────────────
      DOM.quickChips.forEach((chip) => {
        chip.addEventListener('click', QuickPrompts.handleClick);
      });

      // ── Copy response ─────────────────────────────────────
      DOM.copyBtn.addEventListener('click', App.handleCopy);

      // ── Clear history ─────────────────────────────────────
      DOM.clearHistoryBtn.addEventListener('click', () => {
        HistoryManager.clear();
        UIUtils.showToast('History cleared.', 'info');
      });

      // ── API key: submit on Enter ──────────────────────────
      DOM.apiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') DOM.foodInput.focus();
      });
    },

    /**
     * Adds response-list styles dynamically (avoids stylesheet
     * dependency for dynamically-generated HTML elements).
     */
    injectDynamicStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .response-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 12px 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .response-list li {
          padding-left: 20px;
          position: relative;
          font-size: 0.92rem;
          line-height: 1.7;
          color: #f1f5f9;
        }
        .response-list li::before {
          content: '▸';
          position: absolute;
          left: 0;
          color: #4ade80;
          font-size: 0.8rem;
          top: 3px;
        }
        .response-content p {
          margin-bottom: 6px;
        }
        .response-content br {
          display: block;
          margin-bottom: 4px;
        }
      `;
      document.head.appendChild(style);
    },

    /** Entry point — initialises the app */
    init() {
      App.injectDynamicStyles();
      App.bindEvents();
      CharCounter.update(); // Initialise counter display

      console.log(
        '%c🥗 NutriSense Loaded',
        'color: #4ade80; font-weight: bold; font-size: 14px;'
      );
      console.log(
        '%c🔒 Zero-Trust: API key never leaves your browser.',
        'color: #94a3b8; font-size: 12px;'
      );
    },
  };

  /* ── Bootstrap ─────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    // DOM already ready (script loaded with defer or at end of body)
    App.init();
  }

})(); // End of NutriSenseApp IIFE
