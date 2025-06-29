document.addEventListener('DOMContentLoaded', () => {

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
        sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg><span>Light Mode</span>`,
        moon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 0-18z"/></svg><span>Dark Mode</span>`,
        rename: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 20h9"/></svg>`,
        delete: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
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

    /* ───────────────── UTILS ───────────────────────────────────────── */
    const escapeHTML = s => String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    /* ───────────────── MARKED / HIGHLIGHT SETUP ───────────────────── */
    const mdRenderer = new marked.Renderer();
    mdRenderer.code = (code, lang) => {
        const valid = hljs.getLanguage(lang) ? lang : 'plaintext';
        const html  = hljs.highlight(code, { language: valid, ignoreIllegals: true }).value;
        return `<div class="code-block-wrapper"><button class="copy-btn">Copy</button><pre><code class="hljs ${valid}">${html}</code></pre></div>`;
    };
    marked.setOptions({ renderer: mdRenderer });

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
            "gemma3":             "gemma3:4b",
            "qwen3":              "qwen3:8b",
            "llama3.1":           "llama3.1:8b",
            "llama3.2-vision":    "llama3.2-vision:11b",
            "phi4":               "phi4:14b",
            "phi4-mini":          "phi4-mini:3.8b",
            "mistral":            "mistral:7b",
            "moondream":          "moondream:1.4b",
            "neural-chat":        "neural-chat:7b",
            "starling-lm":        "starling-lm:7b",
            "codellama":          "codellama:7b",
            "llama2-uncensored":  "llama2-uncensored:7b",
            "llava":              "llava:7b",
            "granite3.3":         "granite3.3:8b",
            "deepseek-r1":        "deepseek-r1:7b"
        };
    }
    function isInstalled(discoverTag) {
        if (localModels.includes(discoverTag)) return true;
        const root = discoverTag.split(':')[0];
        const hasSuffix = discoverTag.includes(':');
        for (const tag of localModels) {
            if (hasSuffix && root === tag) return true;
            if (!hasSuffix && tag === defaultAliasMap()[discoverTag]) return true;
        }
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
            if (!res.ok) throw new Error(res.statusText);
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let successReported = false;
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (!successReported) pane.innerHTML = '<button class="download-btn" disabled>Downloaded</button>';
                    break;
                }
                decoder.decode(value).split('\n').filter(Boolean).forEach(line => {
                    const data = JSON.parse(line);
                    if (data.total && data.completed) {
                        const pct = Math.round(data.completed / data.total * 100);
                        pane.innerHTML = `<span class="progress-text">Downloading… ${pct}%</span>`;
                    }
                    if (data.status?.includes('success')) {
                        pane.innerHTML = '<button class="download-btn" disabled>Downloaded</button>';
                        successReported = true;
                    } else if (data.status && !data.total) {
                        pane.innerHTML = `<span class="progress-text">${escapeHTML(data.status)}</span>`;
                    }
                });
            }
        } catch (err) {
            console.error(err);
            pane.innerHTML = `<button class="download-btn" data-model-name="${tag}">Retry</button>`;
        } finally {
            await new Promise(r => setTimeout(r, 2000));
            await refreshLocalModels();
        }
    }

    async function uninstallModel(tag, btn) {
        if (!confirm(`Uninstall ${tag}?`)) return;
        const pane = btn.parentElement;
        btn.disabled = true;
        pane.innerHTML = '<span class="progress-text">Removing…</span>';
        try {
            const res = await fetch(`${OLLAMA_HOST}/api/delete`, {
                method: 'DELETE',
                body: JSON.stringify({ model: tag })
            });
            if (!res.ok) throw new Error(res.statusText);
            pane.innerHTML = '<span class="progress-text">Removed</span>';
        } catch (err) {
            console.error(err);
            pane.innerHTML = `<button class="uninstall-btn" data-model-name="${tag}">Retry</button>`;
        } finally {
            await new Promise(r => setTimeout(r, 1000));
            await refreshLocalModels();
        }
    }

    /* ───────────────── REFRESH LOCAL MODELS ───────────────────────── */
    async function refreshLocalModels() {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!res.ok) throw new Error(`Ollama API ${res.status}`);
        const data = await res.json();
        localModels = [...new Set(
            data.models
                .map(m => m.name.replace(/:latest$/, ''))
                .filter(name => name.includes(':'))
        )];
        syncLocalTagsIntoDiscover();
        renderModelSelector();
        renderDiscoverModels();
    }

    /* ───────────────── MODEL SELECTOR ─────────────────────────────── */
    function renderModelSelector() {
        const current = modelSelector.value;
        modelSelector.innerHTML = '';
        if (!localModels.length) {
            modelSelector.innerHTML = '<option>No models installed</option>';
            return;
        }
        localModels.forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag;
            modelSelector.appendChild(opt);
        });
        if (localModels.includes(current)) modelSelector.value = current;
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
        chatHistoryList.innerHTML = '';
        Object.entries(chats)
            .sort((a, b) => b[0] - a[0])
            .forEach(([id, { title }]) => {
                const item = document.createElement('div');
                item.className = 'chat-history-item';
                item.dataset.id = id;
                if (id === activeChatId) item.classList.add('active');
                item.innerHTML = `
                    <span>${escapeHTML(title)}</span>
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
            wrap.innerHTML = `<div class="message assistant">${marked.parse(String(content))}</div>`;
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
            <button class="action-btn regenerate-btn" title="Regenerate response">⟳</button>
            <button class="action-btn copy-response-btn" title="Copy response">⧉</button>`;
        wrap.appendChild(bar);
    }

    /* ───────────────── SCROLL HELPER ─────────────────────────────── */
    function scrollToBottom() {
        if (isAutoScrollEnabled) {
            chatContainerWrapper.scrollTop = chatContainerWrapper.scrollHeight;
        }
    }

    /* ───────────────── CHAT CRUD HELPERS ─────────────────────────── */
    async function saveChat() {
        if (!chatHistory.length) return;
        let title;
        if (activeChatId && chats[activeChatId]) {
            title = chats[activeChatId].title;
        } else {
            activeChatId = String(Date.now());
            title = chatHistory[0].content.slice(0, 40) +
                    (chatHistory[0].content.length > 40 ? '…' : '');
            chats[activeChatId] = { title };
        }
        await window.electronAPI.saveChat({ chatId: activeChatId, data: { title, messages: chatHistory } });
        renderChatList();
    }
    async function renameChat(id, newTitle) {
        const { success } = await window.electronAPI.renameChat(id, newTitle);
        if (success) {
            chats[id].title = newTitle;
            renderChatList();
        } else {
            alert('Rename failed');
        }
    }
    async function deleteChat(id) {
        if (!confirm(`Delete "${escapeHTML(chats[id].title)}"?`)) return;
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
        const data = await window.electronAPI.loadChat(id);
        if (!data) {
            alert('Could not load chat');
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
        if (isGenerating) return;
        isGenerating        = true;
        isAutoScrollEnabled = true;
        const freshChat = activeChatId === null;
        if (freshChat) showConversation();
        addMessage('user', promptText);
        chatHistory.push({ role: 'user', content: promptText });
        if (freshChat) await saveChat();
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
            if (!res.ok) throw new Error(res.statusText);
            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let full = '';
            const msgDiv = assistantWrap.querySelector('.message.assistant');
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (full) {
                        chatHistory.push({ role: 'assistant', content: full });
                        addMessageActions(assistantWrap);
                        await saveChat();
                    } else {
                        assistantWrap.remove();
                        if (freshChat) {
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
                               msgDiv.innerHTML = marked.parse(full);
                           }
                       });
                scrollToBottom();
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                assistantWrap.remove();
            } else {
                assistantWrap.innerHTML = `<div class="message assistant">Error: ${err.message}</div>`;
            }
        } finally {
            isGenerating = false;
        }
    }

    async function regenerateResponse() {
        if (isGenerating || !chatHistory.length) return;
        const idx = chatHistory.findLastIndex(m => m.role === 'user');
        if (idx === -1) return;
        const prompt = chatHistory[idx].content;
        chatHistory.splice(idx);
        const wraps = chatContainer.querySelectorAll('.message-wrapper');
        if (wraps.length >= 2) {
            wraps[wraps.length - 1].remove();
            wraps[wraps.length - 2].remove();
        }
        await handleChatSubmit(prompt);
    }

    function copyCode(btn) {
        const pre = btn.closest('.code-block-wrapper').querySelector('pre');
        navigator.clipboard.writeText(pre.innerText);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    }
    function copyResponse(btn) {
        const wrap = btn.closest('.message-wrapper');
        navigator.clipboard.writeText(wrap.querySelector('.assistant').innerText);
    }

    function autoResizeTextarea() {
        promptInput.style.height = 'auto';
        promptInput.style.height = `${promptInput.scrollHeight}px`;
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
                ok.removeEventListener('click', onOK);
                cancel.removeEventListener('click', onCancel);
                input.removeEventListener('keydown', onKey);
                resolve(val);
            };
            const onOK     = () => close(input.value.trim());
            const onCancel = () => close(null);
            const onKey    = e => {
                if (e.key === 'Enter') onOK();
                if (e.key === 'Escape') onCancel();
            };
            ok.addEventListener('click', onOK);
            cancel.addEventListener('click', onCancel);
            input.addEventListener('keydown', onKey);
        });
    }

    /* ───────────────── NEW CHAT JS (complete) ─────────────────────── */
    function startNewChat() {
        if (isGenerating && chatAbortCtrl) {
            chatAbortCtrl.abort();
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
    modelSelector.addEventListener('change', startNewChat);
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
                       chatContainerWrapper.clientHeight + 10;
        isAutoScrollEnabled = bottom;
    });

    // Wire up suggestion cards to start fresh chat and submit prompt immediately
    suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            if (!prompt) return;

            startNewChat(); // clear old chat

            promptInput.value = prompt;
            promptForm.requestSubmit();
        });
    });

    async function initialize() {
        setupTheme();
        await loadChatsFromDisk();
        renderChatList();
        showStatus('Connecting to Ollama…');
        try {
            await refreshLocalModels();
            startNewChat();
        } catch (err) {
            console.error(err);
            showStatus('Connection Failed', 'Ensure the Ollama daemon is running.');
        }
    }
    initialize();
});
