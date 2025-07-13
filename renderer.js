// --- START OF FILE renderer.js ---

document.addEventListener('DOMContentLoaded', () => {

    if (!Array.prototype.findLastIndex) {
        Array.prototype.findLastIndex = function(fn, thisArg) {
            for (let i = this.length - 1; i >= 0; i--) {
                if (fn.call(thisArg, this[i], i, this)) return i;
            }
            return -1;
        };
    }

    /* ───────────────── CONFIG & GLOBAL STATE ───────────────────────── */
    const OLLAMA_HOST       = 'http://localhost:11434';
    let localModels         = [];
    let isGenerating        = false;
    let chatAbortCtrl       = null;
    let chatHistory         = [];
    let chats               = {};
    let activeChatId        = null;
    let isAutoScrollEnabled = true;

    /* ───────────────── DISCOVER CATALOG ────────────────────────────── */
    const DISCOVER_MODELS = [
        { family: 'Gemma 3', size: '1B', gb: '815MB',  name: 'gemma3:1b' },
        { family: 'Gemma 3', size: '4B', gb: '3.3GB',  name: 'gemma3' },
        { family: 'Gemma 3', size: '12B', gb: '8.1GB', name: 'gemma3:12b' },
        { family: 'Gemma 3', size: '27B', gb: '17GB', name: 'gemma3:27b' },

        { family: 'Qwen 3', size: '0.6B',  gb: '523MB',  name: 'qwen3:0.6b' },
        { family: 'Qwen 3', size: '1.7B',  gb: '1.4GB',  name: 'qwen3:1.7b' },
        { family: 'Qwen 3', size: '4B',    gb: '2.6GB',  name: 'qwen3:4b' },
        { family: 'Qwen 3', size: '8B',    gb: '5.2GB',  name: 'qwen3' },
        { family: 'Qwen 3', size: '14B',   gb: '9.3GB',  name: 'qwen3:14b' },
        { family: 'Qwen 3', size: '30B',   gb: '19GB',   name: 'qwen3:30b' },
        { family: 'Qwen 3', size: '32B',   gb: '20GB',   name: 'qwen3:32b' },
        { family: 'Qwen 3', size: '235B',  gb: '142GB',  name: 'qwen3:235b' },

        { family: 'DeepSeek-R1', size: '7B',  gb: '4.7GB',   name: 'deepseek-r1' },
        { family: 'DeepSeek-R1', size: '671B', gb: '404GB',  name: 'deepseek-r1:671b' },

        { family: 'Llama 4',      size: '109B', gb: '67GB',   name: 'llama4:scout' },
        { family: 'Llama 4',      size: '400B', gb: '245GB', name: 'llama4:maverick' },
        { family: 'Llama 3.3',    size: '70B',  gb: '43GB',   name: 'llama3.3' },
        { family: 'Llama 3.2',    size: '1B',   gb: '1.3GB',  name: 'llama3.2:1b' },
        { family: 'Llama 3.2 Vision', size: '11B', gb: '7.9GB', name: 'llama3.2-vision' },
        { family: 'Llama 3.2 Vision', size: '90B', gb: '55GB', name: 'llama3.2-vision:90b' },
        { family: 'Llama 3.1',      size: '8B',  gb: '4.7GB',  name: 'llama3.1' },
        { family: 'Llama 3.1',      size: '405B', gb: '231GB', name: 'llama3.1:405b' },

        { family: 'Phi 4',        size: '14B',  gb: '9.1GB', name: 'phi4' },
        { family: 'Phi 4 Mini',   size: '3.8B', gb: '2.5GB', name: 'phi4-mini' },
        { family: 'Phi 4 Mini',   size: '3.8B', gb: '2.5GB', name: 'phi4-mini-reasoning:3.8b' },
        { family: 'Mistral',      size: '7B',   gb: '4.1GB', name: 'mistral' },
        { family: 'Moondream 2',  size: '1.4B', gb: '829MB', name: 'moondream' },
        { family: 'Neural Chat',  size: '7B',   gb: '4.1GB', name: 'neural-chat' },
        { family: 'Starling',     size: '7B',   gb: '4.1GB', name: 'starling-lm' },
        { family: 'Code Llama',   size: '7B',   gb: '3.8GB', name: 'codellama' },
        { family: 'Llama 2 Uncensored', size: '7B', gb: '3.8GB', name: 'llama2-uncensored' },
        { family: 'LLaVA',        size: '7B',   gb: '4.5GB', name: 'llava' },
        { family: 'Granite 3.3',  size: '8B',   gb: '4.9GB', name: 'granite3.3' }
    ];

    /* ───────────────── ICONS (inline SVG) ─────────────────────────── */
    const ICONS = {
        sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zm-9-8c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zm0 16c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zM5.64 6.36c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L5.64 9.18c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41zm12.72 12.72c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41l-1.41 1.41c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41l1.41-1.41zM5.64 19.07c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0l1.41 1.41c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0l-1.41-1.41zM18.36 6.36c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.41-1.41z"/></svg><span>Light Mode</span>`,
        moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9.37 5.51c.46-1.03.3-2.27-.5-3.15C6.73 1.1 4.25 2.14 3.93 4.45c-.23 1.7.63 3.32 2.12 4.14.9.49 1.93.48 2.83-.02-.13.54-.15 1.12-.02 1.68.18.73.59 1.35 1.14 1.82.72.63 1.63.95 2.58.91.88-.03 1.73-.4 2.37-1.03.45-.45.8-1 .97-1.62.18-.65.16-1.35-.08-1.98.65.17 1.34.14 1.95-.08.57-.2 1.08-.55 1.48-1.02.79-.9 1.18-2.12.87-3.33-.26-1.02-.88-1.88-1.74-2.42-.64-.4-1.38-.63-2.15-.63-1.13 0-2.2.49-2.92 1.32-.44.52-.72 1.17-.82 1.87-.04.3-.04.6-.04.9 0 .19.01.38.03.56.02.19.02.38.02.57 0 .29-.02.58-.06.86-.08.6-.33 1.17-.74 1.63-.41.46-1 .78-1.63.92-.53.12-1.09.07-1.61-.13.34-.63.49-1.36.4-2.09-.1-.82-.54-1.54-1.17-2.07z"/></svg><span>Dark Mode</span>`,
        rename: `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 0 24 24" width="16px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M5 18.08V19h.92l9.06-9.06-.92-.92L5 18.08zM17.85 4.87c-.2-.2-.51-.2-.71 0l-1.77 1.77.92.92L17.85 5.58c.2-.2.2-.51 0-.71l-.21-.2zM20.71 5.63l-2.34-2.34c-.2-.2-.51-.2-.71 0l-1.83 1.83 2.34 2.34 1.83-1.83c.2-.2.2-.51 0-.71zM3 21h18v-2H3v2z"/></svg>`,
        delete: `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 0 24 24" width="16px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>`
    };

    /* ───────────────── DOM REFERENCES ─────────────────────────────── */
    const modelSelector    = document.getElementById('model-selector');
    const statusContainer  = document.getElementById('status-container');
    const welcomeContainer = document.getElementById('chat-welcome-container');
    const conversationArea = document.getElementById('chat-conversation-area');
    const chatContainerWrapper = document.getElementById('chat-container-wrapper');
    const chatContainer    = document.getElementById('chat-container');
    const promptForm       = document.getElementById('prompt-form');
    const promptInput      = document.getElementById('prompt-input');
    const navLinks         = document.querySelectorAll('.nav-link');
    const modelList        = document.getElementById('model-list');
    const modelSearch      = document.getElementById('model-search-bar');
    const newChatBtn       = document.getElementById('new-chat-btn');
    const chatHistoryList  = document.getElementById('chat-history-list');
    const themeToggle      = document.getElementById('theme-toggle');
    const suggestionCards  = document.querySelectorAll('.suggestion-card');
	/* DO NOT MODIFY THE ESCAPEHTML STUFF NO AMTTER WHAT, DO NOT MODIFY IT EVER, do not modify it
    /* ───────────────── UTILS ───────────────────────────────────────── */
    const escapeHTML = s => String(s)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

    function sanitizeChatId(id) {
        return /^[\w-]+$/.test(id) ? id : null;
    }



    /* ───────────────── MARKED / HIGHLIGHT / KATEX SETUP ───────────── */
    const mdRenderer = new marked.Renderer();
    mdRenderer.code = (code, lang) => {
  const language = typeof lang === 'string' ? lang.toLowerCase() : '';
  const valid = hljs.getLanguage(language) ? language : 'plaintext';

  const codeStr = typeof code === 'string'
    ? code
    : (code && code.text
        ? code.text
        : (code && code.value
            ? code.value
            : JSON.stringify(code)));

  const html = hljs.highlight(codeStr, {
    language: valid,
    ignoreIllegals: true
  }).value;

  return `
    <div class="code-block-wrapper">
      <button class="copy-btn">Copy</button>
      <pre><code class="hljs ${valid}">${html}</code></pre>
    </div>`;
};



    // Use the KaTeX extension for math formulas
    if (window.markedKatex) {
        marked.use(markedKatex({ throwOnError: false }));
    }

    // Configure marked options
    marked.setOptions({
        renderer: mdRenderer,
        gfm: true,
        breaks: true
    });
    
    // Helper to parse markdown synchronously, for compatibility with the new marked version
    function parseMarkdown(text) {
        const raw = marked.parse(text, { async: false });
        return DOMPurify.sanitize(raw);
    }

    /* ───────────────── THEME HANDLING ─────────────────────────────── */
    function setupTheme() {
        const saved = localStorage.getItem('theme') || 'dark';
        if (saved === 'light') document.body.classList.add('light-mode');
        updateThemeToggleUI();
    }
    function toggleTheme() {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
        updateThemeToggleUI();
    }
    function updateThemeToggleUI() {
        themeToggle.innerHTML = document.body.classList.contains('light-mode') ? ICONS.sun : ICONS.moon;
        window.electronAPI.setTheme(document.body.classList.contains('light-mode') ? 'light' : 'dark');
    }

    /* ───────────────── INSTALL CHECK ──────────────────────────────── */
    function defaultAliasMap() {
        return {
            "gemma3": "gemma3:4b",
            "qwen3": "qwen3:8b",
            "llama3.1": "llama3.1:8b",
            "llama3.2-vision": "llama3.2-vision:11b",
            "phi4": "phi4:14b",
            "phi4-mini": "phi4-mini:3.8b",
            "mistral": "mistral:7b",
            "moondream": "moondream:1.4b",
            "neural-chat": "neural-chat:7b",
            "starling-lm": "starling-lm:7b",
            "codellama": "codellama:7b",
            "llama2-uncensored": "llama2-uncensored:7b",
            "llava": "llava:7b",
            "granite3.3": "granite3.3:8b",
            "deepseek-r1": "deepseek-r1:7b"
        };
    }
    
    // FIX: Completely rewritten isInstalled logic for accuracy. Please refrain in most cases from changing this, simply just never change it EVER, never ever change the following function.
    function isInstalled(discoverTag) {
    if (localModels.includes(discoverTag)) return true;

    const aliasMap = defaultAliasMap();

    // Check if the discoverTag is an alias for an actual model tag
    if (aliasMap[discoverTag] && localModels.includes(aliasMap[discoverTag])) return true;

    // Check if any installed model is an alias for the discoverTag
    for (const [alias, actual] of Object.entries(aliasMap)) {
        if (actual === discoverTag && localModels.includes(alias)) return true;
    }

    // Fuzzy check: phi4 matches phi4:14b, phi4-mini matches phi4-mini:3.8b, etc.
    if (localModels.some(tag =>
        tag === discoverTag ||
        tag.startsWith(discoverTag + ':') ||
        discoverTag.startsWith(tag + ':')
    )) return true;

    return false;
}



    /* ───────────────── RENDER & SYNC ─────────────────────────────── */
    function renderDiscoverModels() {
        const q = modelSearch.value.toLowerCase().trim();
        const grouped = DISCOVER_MODELS.reduce((acc, m) => {
            const hit = !q || Object.values(m).some(v => String(v).toLowerCase().includes(q));
            if (hit) (acc[m.family] = acc[m.family] || []).push(m);
            return acc;
        }, {});
        modelList.innerHTML = '';
        Object.keys(grouped).sort().forEach(fam => {
            const variants = grouped[fam];
            const groupEl  = document.createElement('div');
            groupEl.className = 'model-group';
            groupEl.innerHTML = `<div class="model-group-header"><span>${fam}</span></div>`;
            variants.forEach((m, idx) => {
                const hide = idx > 3 ? 'extra-variant' : '';
                const style = idx > 3 ? 'style="display:none;"' : '';
                const have  = isInstalled(m.name);
                groupEl.innerHTML +=
                    `<div class="model-variant ${hide}" ${style}>
                         <div class="model-info"><strong>${m.size}</strong><span>${m.gb}</span></div>
                         <div class="download-status">
                             ${have
                                ? `<button class="uninstall-btn" data-model-name="${m.name}">Uninstall</button>`
                                : `<button class="download-btn" data-model-name="${m.name}">Download</button>`}
                         </div>
                     </div>`;
            });
            if (variants.length > 4) {
                groupEl.innerHTML +=
                    `<div class="toggle-wrapper">
                         <button class="toggle-more-btn" data-expanded="false">Show more</button>
                     </div>`;
            }
            modelList.appendChild(groupEl);
        });
    }
    function handleToggle(btn) {
        const group = btn.closest('.model-group');
        const extras = group.querySelectorAll('.extra-variant');
        const expand = btn.dataset.expanded === 'false';
        extras.forEach(v => v.style.display = expand ? '' : 'none');
        btn.dataset.expanded = expand ? 'true' : 'false';
        btn.textContent      = expand ? 'Show less' : 'Show more';
    }
    function syncLocalTagsIntoDiscover() {
        for (let i = DISCOVER_MODELS.length - 1; i >= 0; i--) {
            if (DISCOVER_MODELS[i].family === 'Other Installed') {
                DISCOVER_MODELS.splice(i, 1);
            }
        }
        const known = new Set(DISCOVER_MODELS.map(m => m.name));
        localModels.forEach(tag => {
            if (!known.has(tag)) {
                DISCOVER_MODELS.push({ family: 'Other Installed', size: 'local', gb: '', name: tag });
                known.add(tag);
            }
        });
    }

    /* ───────────────── DOWNLOAD MODEL ─────────────────────────────── */
    async function downloadModel(tag, btn) {
        const pane = btn.parentElement;
        btn.disabled = true;
        pane.innerHTML = '<span class="progress-text">Starting…</span>';
        try {
            const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
                method: 'POST',
                body: JSON.stringify({ name: tag, stream: true })
            });
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                decoder.decode(value).split('\n').filter(Boolean).forEach(line => {
                    const data = JSON.parse(line);
                    if (data.total && data.completed) {
                        const pct = Math.round(data.completed / data.total * 100);
                        pane.innerHTML = `<span class="progress-text">Downloading… ${pct}%</span>`;
                    } else if (data.status && !data.total) {
                        pane.innerHTML = `<span class="progress-text">${escapeHTML(data.status)}</span>`;
                    }
                    if (data.status?.includes('success')) {
                         pane.innerHTML = `<span class="progress-text">Success!</span>`;
                    }
                });
            }
        } catch (err) {
            console.error(err);
            pane.innerHTML = `<span>Error</span><button class="download-btn" data-model-name="${tag}">Retry</button>`;
        } finally {
            // FIX: Remove setTimeout and refresh immediately for responsive UI.
            await refreshLocalModels();
        }
    }

    async function uninstallModel(tag, btn) {
        if (!confirm(`Are you sure you want to uninstall ${tag}?`)) return;
        const pane = btn.parentElement;
        btn.disabled = true;
        pane.innerHTML = '<span class="progress-text">Removing…</span>';
        try {
            await fetch(`${OLLAMA_HOST}/api/delete`, {
                method: 'DELETE',
                body: JSON.stringify({ name: tag })
            });
        } catch (err) {
            console.error(err);
            pane.innerHTML = `<span>Error</span><button class="uninstall-btn" data-model-name="${tag}">Retry</button>`;
        } finally {
            // FIX: Remove setTimeout and refresh immediately.
            await refreshLocalModels();
        }
    }

    /* ───────────────── REFRESH LOCAL MODELS ───────────────────────── */
    async function refreshLocalModels() {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
        const data = await res.json();
        localModels = data.models.map(m => m.name); // Keep the full tag including ':latest'
        
        syncLocalTagsIntoDiscover();
        renderModelSelector();
        renderDiscoverModels();
    }

    /* ───────────────── MODEL SELECTOR ─────────────────────────────── */
    function renderModelSelector() {
        const current = modelSelector.value;
        modelSelector.innerHTML = '';
        if (!localModels.length) {
            modelSelector.innerHTML = '<option value="">No models installed</option>';
            modelSelector.disabled = true;
            return;
        }
        modelSelector.disabled = false;
        localModels.sort().forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            // Show a friendlier name, e.g., 'llama3:8b' -> 'llama3 (8b)'
            opt.textContent = tag.replace(/:([a-zA-Z0-9.-]+)$/, ' ($1)').replace(/:latest$/, '');
            modelSelector.appendChild(opt);
        });
        if (localModels.includes(current)) {
            modelSelector.value = current;
        } else if(localModels.length > 0) {
            modelSelector.value = localModels[0];
        }
    }

    /* ───────────────── VIEW HELPERS ───────────────────────────────── */
    function showStatus(msg, detail = '') {
        conversationArea.style.display = 'none';
        welcomeContainer.style.display = 'none';
        statusContainer.style.display  = 'flex';
        statusContainer.innerHTML      = `<h2>${msg}</h2><p>${detail}</p>`;
    }
    function showWelcomeScreen() {
        statusContainer.style.display  = 'none';
        welcomeContainer.style.display = 'flex';
        conversationArea.style.display = 'flex';
        chatContainerWrapper.style.display = 'none';
    }
    function showConversation() {
        statusContainer.style.display  = 'none';
        welcomeContainer.style.display = 'none';
        conversationArea.style.display = 'flex';
        chatContainerWrapper.style.display = 'flex';
    }

    /* ───────────────── CHAT STORAGE & RENDERING ───────────────────── */
    async function loadChatsFromDisk() { chats = await window.electronAPI.getChats(); }
    
    function renderChatList() {
        // FIX: Add loading state
        if (Object.keys(chats).length === 0 && chatHistoryList.innerHTML.includes('Loading')) {
            chatHistoryList.innerHTML = '<div class="no-chats-message">No chats yet.</div>';
            return;
        }
        chatHistoryList.innerHTML = '';
        Object.entries(chats)
            .sort((a, b) => b[0] - a[0]) // Sort by timestamp (chatId)
            .forEach(([id, { title }]) => {
                const item = document.createElement('div');
                item.className = 'chat-history-item';
                item.dataset.id = id;
                if (id === activeChatId) item.classList.add('active');
                item.innerHTML = `
                    <span title="${escapeHTML(title)}">${escapeHTML(title)}</span>
                    <div class="chat-item-actions">
                        <button class="chat-item-btn rename-btn" title="Rename">${ICONS.rename}</button>
                        <button class="chat-item-btn delete-btn" title="Delete">${ICONS.delete}</button>
                    </div>`;
                chatHistoryList.appendChild(item);
            });
    }

    /* ───────────────── CHAT MESSAGE RENDER ───────────────────────── */
    function addMessage(role, content, autoScroll = true) {
        const wrap = document.createElement('div');
        wrap.className = 'message-wrapper';
        if (role === 'user') {
            wrap.innerHTML = `<div class="message user">${escapeHTML(content)}</div>`;
        } else if (content === 'thinking') {
            wrap.innerHTML = `<div class="message assistant thinking"><div class="thinking-star"></div><span>Thinking…</span></div>`;
        } else {
            wrap.innerHTML = `<div class="message assistant">${parseMarkdown(String(content))}</div>`;
            if (content) addMessageActions(wrap);
        }
        chatContainer.appendChild(wrap);
        if (autoScroll) scrollToBottom();
        return wrap;
    }
    function addMessageActions(wrap) {
        if (wrap.querySelector('.action-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'action-bar';
        bar.innerHTML = `
            <button class="action-btn regenerate-btn" title="Regenerate response">
                <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="action-btn copy-response-btn" title="Copy response">
                 <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>`;
        wrap.appendChild(bar);
    }

    /* ───────────────── SCROLL HELPER ─────────────────────────────── */
    function scrollToBottom() {
        if (isAutoScrollEnabled) {
            chatContainerWrapper.scrollTop = chatContainerWrapper.scrollHeight;
        }
    }

    /* ───────────────── CHAT CRUD HELPERS ─────────────────────────── */
    // FIX: Smarter chat title generation
    async function generateChatTitle(chatId, history) {
        try {
            const titlePrompt = {
                role: 'user',
                content: `Based on our conversation, create a very short, concise title for this chat (4-5 words max). Do not use quotes.`
            };
            const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
                method: 'POST',
                body: JSON.stringify({
                    model: modelSelector.value,
                    messages: [...history, titlePrompt],
                    stream: false
                }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const newTitle = data.message?.content?.trim().replace(/["']/g, '');
            if (newTitle && chats[chatId]) {
                await renameChat(chatId, newTitle);
            }
        } catch(e) {
            console.error("Failed to generate chat title", e);
        }
    }

    async function saveChat(isNewChat = false) {
        if (!chatHistory.length) return;
        let title;
        if (activeChatId && chats[activeChatId]) {
            title = chats[activeChatId].title;
        } else {
            activeChatId = String(Date.now());
            // Use a simple, temporary title first
            title = chatHistory[0].content.slice(0, 40) +
                    (chatHistory[0].content.length > 40 ? '…' : '');
            chats[activeChatId] = { title };
        }
        if (!sanitizeChatId(activeChatId)) return;
        await window.electronAPI.saveChat({ chatId: activeChatId, data: { title, messages: chatHistory } });
        renderChatList();

        // If it's the very first response of a new chat, generate a better title in the background
        if (isNewChat && chatHistory.length === 2) {
            generateChatTitle(activeChatId, chatHistory);
        }
    }
    
    async function renameChat(id, newTitle) {
        if (!newTitle || !chats[id]) return;
        if (!sanitizeChatId(id)) return;
        const { success } = await window.electronAPI.renameChat(id, newTitle);
        if (success) {
            chats[id].title = newTitle;
            renderChatList(); // Re-render the list to show the new title
        }
    }
    
    async function deleteChat(id) {
        if (!confirm(`Delete "${escapeHTML(chats[id].title)}"?`)) return;
        if (!sanitizeChatId(id)) return;
        const { success } = await window.electronAPI.deleteChat(id);
        if (success) {
            delete chats[id];
            if (activeChatId === id) startNewChat();
            else renderChatList();
        } else {
            alert('Delete failed');
        }
    }
    async function loadChat(id) {
        if (!sanitizeChatId(id)) return;
        const data = await window.electronAPI.loadChat(id);
        if (!data) {
            alert('Could not load chat');
            delete chats[id];
            renderChatList();
            return;
        }
        activeChatId = id;
        chatHistory  = data.messages || [];
        chatContainer.innerHTML = '';
        chatHistory.forEach(m => addMessage(m.role, m.content, false));
        showConversation();
        renderChatList();
        scrollToBottom();
    }

    /* ───────────────── CHAT SUBMIT / GENERATE ─────────────────────── */
    async function handleChatSubmit(promptText) {
        if (isGenerating || modelSelector.value === "") return;
        isGenerating        = true;
        isAutoScrollEnabled = true;
        const isNewChat = activeChatId === null;
        if (isNewChat) showConversation();

        addMessage('user', promptText);
        chatHistory.push({ role: 'user', content: promptText });
        if (isNewChat) await saveChat(); // Save with temporary title
        
        promptInput.value = '';
        promptInput.style.height = 'auto';
        const assistantWrap = addMessage('assistant', 'thinking');
        chatAbortCtrl = new AbortController();
        try {
            const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
                method: 'POST',
                body: JSON.stringify({
                    model: modelSelector.value,
                    messages: chatHistory,
                    stream: true
                }),
                signal: chatAbortCtrl.signal
            });
            if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let full = '';
            const msgDiv = assistantWrap.querySelector('.message.assistant');
            assistantWrap.scrollIntoView({ behavior: 'smooth', block: 'end' });

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (full) {
                        chatHistory.push({ role: 'assistant', content: full });
                        addMessageActions(assistantWrap);
                        await saveChat(isNewChat);
                    } else {
                        assistantWrap.remove(); // Remove 'thinking' if no response
                        if (isNewChat) { // If it was a new chat that failed, delete it
                           await window.electronAPI.deleteChat(activeChatId);
                           startNewChat();
                        }
                    }
                    break;
                }
                decoder.decode(value)
                       .split('\n')
                       .filter(Boolean)
                       .forEach(line => {
                           const data = JSON.parse(line);
                           if (data.message?.content) {
                               if (!full) msgDiv.classList.remove('thinking');
                               full += data.message.content;
                               msgDiv.innerHTML = parseMarkdown(full);
                           }
                           if (data.done && data.error) {
                               throw new Error(data.error);
                           }
                       });
                scrollToBottom();
            }
        } catch (err) {
            console.error(err);
            if (err.name === 'AbortError') {
                assistantWrap.remove();
            } else {
                assistantWrap.innerHTML = `<div class="message assistant error"><strong>Error:</strong> ${escapeHTML(err.message)}</div>`;
            }
        } finally {
            isGenerating = false;
            chatAbortCtrl = null;
        }
    }

    // FIX: Robust regeneration logic
    async function regenerateResponse() {
        if (isGenerating || chatHistory.length < 2) return;

        // Find the last user prompt to resubmit
        const lastUserIndex = chatHistory.findLastIndex(m => m.role === 'user');
        if (lastUserIndex === -1) return;

        const promptToResubmit = chatHistory[lastUserIndex].content;

        chatHistory = chatHistory.slice(0, lastUserIndex + 1);
        while (chatContainer.children.length > chatHistory.length) {
            chatContainer.lastElementChild.remove();
        }

        // Submit the prompt again
        await handleChatSubmit(promptToResubmit);
    }

    function copyCode(btn) {
        const pre = btn.closest('.code-block-wrapper').querySelector('pre');
        navigator.clipboard.writeText(pre.innerText).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 2000);
        }).catch(() => {
            alert('Copy failed');
        });
    }
    function copyResponse(btn) {
        const wrap = btn.closest('.message-wrapper');
        const assistantMessage = wrap.querySelector('.assistant');
        if (assistantMessage) {
            navigator.clipboard.writeText(assistantMessage.innerText).catch(() => alert('Copy failed'));
        }
    }

    function autoResizeTextarea() {
        promptInput.style.height = 'auto';
        promptInput.style.height = `${Math.min(promptInput.scrollHeight, 200)}px`;
    }

    function showRenameModal(current) {
        return new Promise(resolve => {
            const backdrop = document.getElementById('rename-modal-backdrop');
            const input    = document.getElementById('rename-modal-input');
            const ok       = document.getElementById('rename-modal-ok');
            const cancel   = document.getElementById('rename-modal-cancel');
            input.value = current || '';
            backdrop.classList.add('active');
            input.focus();
            input.select();
            const close = val => {
                backdrop.classList.remove('active');
                ok.onclick = null;
                cancel.onclick = null;
                input.onkeydown = null;
                resolve(val);
            };
            const onOK     = () => close(input.value.trim());
            const onCancel = () => close(null);
            const onKey    = e => {
                if (e.key === 'Enter') onOK();
                if (e.key === 'Escape') onCancel();
            };
            ok.onclick = onOK;
            cancel.onclick = onCancel;
            input.onkeydown = onKey;
        });
    }

    function startNewChat() {
        // FIX: More robustly handle aborting an ongoing chat.
        // This ensures the UI unlocks even if something went wrong with the AbortController.
        if (isGenerating) {
            if (chatAbortCtrl) {
                chatAbortCtrl.abort();
            }
            isGenerating = false;
        }
        chatAbortCtrl = null;
        activeChatId = null;
        chatHistory = [];
        chatContainer.innerHTML = '';
        showWelcomeScreen();
        renderChatList();
    }

    /* ───────────────── EVENT LISTENERS ────────────────────────────── */
    modelList.addEventListener('click', e => {
        const dl = e.target.closest('.download-btn');
        if (dl && !dl.disabled) { downloadModel(dl.dataset.modelName, dl); return; }
        const un = e.target.closest('.uninstall-btn');
        if (un) { uninstallModel(un.dataset.modelName, un); return; }
        const toggle = e.target.closest('.toggle-more-btn');
        if (toggle) { handleToggle(toggle); return; }
    });
    modelSearch.addEventListener('input', renderDiscoverModels);
    themeToggle.addEventListener('click', toggleTheme);
    newChatBtn.addEventListener('click', startNewChat);
    chatHistoryList.addEventListener('click', async e => {
        const item = e.target.closest('.chat-history-item');
        if (!item) return;
        const id = item.dataset.id;
        if (e.target.closest('.rename-btn')) {
            const newTitle = await showRenameModal(chats[id].title);
            if (newTitle && newTitle !== chats[id].title) await renameChat(id, newTitle);
            return;
        }
        if (e.target.closest('.delete-btn')) {
            await deleteChat(id);
            return;
        }
        if (id !== activeChatId) {
            await loadChat(id);
        }
    });

    navLinks.forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.view')
                .forEach(v => v.classList.toggle('active', v.id === a.dataset.view));
        navLinks.forEach(l => l.classList.toggle('active', l === a));
        if (a.dataset.view === 'chat-view' && activeChatId === null) {
            if (localModels.length) showWelcomeScreen();
            else showStatus('No Models Found', 'Visit the Models tab to download one.');
        }
    }));

    promptForm.addEventListener('submit', e => {
        e.preventDefault();
        const text = promptInput.value.trim();
        if (text) handleChatSubmit(text);
    });
    promptInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            promptForm.requestSubmit();
        }
    });
    promptInput.addEventListener('input', autoResizeTextarea);

    chatContainer.addEventListener('click', e => {
        const copyBtn  = e.target.closest('.copy-btn');
        const regenBtn = e.target.closest('.regenerate-btn');
        const copyAll  = e.target.closest('.copy-response-btn');
        if (copyBtn)  copyCode(copyBtn);
        if (copyAll)  copyResponse(copyAll);
        if (regenBtn) regenerateResponse();
    });

    chatContainerWrapper.addEventListener('scroll', () => {
        const bottom = chatContainerWrapper.scrollHeight -
                       chatContainerWrapper.scrollTop <=
                       chatContainerWrapper.clientHeight + 20; // A little buffer
        isAutoScrollEnabled = bottom;
    });
    
    suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            if (!prompt || isGenerating || modelSelector.value === "") return;

            startNewChat(); 

            // A small delay to ensure the view transition is complete before submitting
            setTimeout(() => {
                promptInput.value = prompt;
                promptForm.requestSubmit();
            }, 50);
        });
    });

    async function initialize() {
        setupTheme();
        chatHistoryList.innerHTML = '<div class="no-chats-message">Loading...</div>';
        await loadChatsFromDisk();
        renderChatList();
        showStatus('Connecting to Ollama…');
        try {
            await refreshLocalModels();
            if (localModels.length > 0) {
                 startNewChat();
            } else {
                 showStatus('No Models Found', 'Visit the Models tab to download one.');
            }
        } catch (err) {
            console.error(err);
            showStatus('Connection Failed', 'Ensure Ollama is running and accessible at http://localhost:11434.');
        }
    }
    initialize();
});