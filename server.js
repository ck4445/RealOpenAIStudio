// --- START OF FILE server.js ---

const express = require('express');
// MODIFIED: Import 'exec' from child_process and the new 'open' package
const { exec } = require('child_process');
const open = require('open'); // <-- ADD THIS LINE
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = 5001;

const isPackaged = !!process.pkg;
const baseDir = isPackaged ? path.dirname(process.execPath) : __dirname;

let ollamaProcess = null;
let isManagedByApp = false;

const CHATS_DIR = path.join(baseDir, 'chats');

// --- NEW: Auto-Kill Function for a Clean Start ---
function autoKillOllama() {
    return new Promise((resolve) => {
        console.log('Attempting to terminate any existing Ollama processes...');
        const command = process.platform === 'win32' 
            ? 'taskkill /F /IM ollama.exe' 
            : 'pkill -f ollama';

        exec(command, (error, stdout, stderr) => {
            if (error && !stderr.includes("not found")) {
                // Log error only if it's not the "process not found" error
                console.warn(`Warning during pre-emptive kill: ${stderr}`);
            } else {
                console.log('Pre-emptive kill command executed successfully.');
            }
            // Always resolve, even if it fails (means no process was running)
            resolve();
        });
    });
}


// --- Ollama Process Management (No changes in this section) ---
function killOllamaProcess() {
  if (!ollamaProcess || ollamaProcess.killed) return;
  const { spawn } = require('child_process'); // Local require to avoid bundling issues
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(ollamaProcess.pid), '/t', '/f']);
  } else {
    try { process.kill(-ollamaProcess.pid, 'SIGTERM'); } catch {}
  }
}
function isOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { // Quicker timeout
      req.destroy();
      resolve(false);
    });
  });
}
function startOllama() {
  const { spawn } = require('child_process'); // Local require
  const platform = process.platform;
  const args = ['serve'];
  let command = 'ollama';
  if (platform === 'win32') {
    const winPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
    if (fsSync.existsSync(winPath)) command = winPath;
  }
  try {
    ollamaProcess = spawn(command, args, { detached: true });
  } catch (err) {
    const fallback = platform === 'darwin' ? '/usr/local/bin/ollama' : '/usr/bin/ollama';
    if (fsSync.existsSync(fallback)) {
      ollamaProcess = spawn(fallback, args, { detached: true });
    } else {
      throw err;
    }
  }
  setupOllamaListeners();
}
function setupOllamaListeners() {
    if (!ollamaProcess) return;
    isManagedByApp = true;
    ollamaProcess.stdout.on('data', (data) => console.log(`Ollama STDOUT: ${data}`));
    ollamaProcess.stderr.on('data', (data) => console.error(`Ollama STDERR: ${data}`));
    ollamaProcess.on('close', (code) => {
        console.log(`Managed Ollama process exited with code ${code}`);
        isManagedByApp = false;
    });
    ollamaProcess.on('error', (err) => {
        console.error('Failed to start/run managed Ollama process:', err);
        isManagedByApp = false;
    });
}
function checkOllamaReady() {
  return new Promise((resolve, reject) => {
    const interval = 1000;
    const timeout = 20000;
    let elapsedTime = 0;
    const timer = setInterval(async () => {
      if (await isOllamaRunning()) {
        clearInterval(timer);
        console.log('Ollama server is ready.');
        resolve();
      } else {
        elapsedTime += interval;
        if (elapsedTime >= timeout) {
          clearInterval(timer);
          console.error('Ollama server did not start in time.');
          reject(new Error('Ollama server timeout.'));
        }
      }
    }, interval);
  });
}

// --- Storage and Helpers (No changes in this section) ---
async function setupStorage() {
    try {
        await fs.mkdir(CHATS_DIR, { recursive: true });
        console.log(`Chats directory created or already exists at: ${CHATS_DIR}`);
    } catch (error) {
        console.error("Failed to create chats directory:", error);
        process.exit(1);
    }
}
function sanitizeChatId(id) {
  if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) {
    throw new Error('Invalid chat ID');
  }
  return id;
}

// --- Express Server Setup ---
app.use(express.json());
app.use(express.static(baseDir));

// --- API Endpoints (No changes in this section) ---
app.get('/api/chats', async (req, res) => { try { const files = (await fs.readdir(CHATS_DIR)).filter(file => file.endsWith('.json')); const chats = {}; await Promise.all(files.map(async file => { const filePath = path.join(CHATS_DIR, file); try { const content = JSON.parse(await fs.readFile(filePath, 'utf-8')); const chatId = path.basename(file, '.json'); chats[chatId] = { title: content.title }; } catch (e) { console.error(`Could not read or parse chat file: ${file}`, e); } })); res.json(chats); } catch (error) { console.error("Could not get chats:", error); res.status(500).json({}); } });
app.get('/api/chats/:chatId', async (req, res) => { try { const chatId = sanitizeChatId(req.params.chatId); const filePath = path.join(CHATS_DIR, `${chatId}.json`); const content = await fs.readFile(filePath, 'utf-8'); res.json(JSON.parse(content)); } catch (error) { console.error(`Could not load chat ${req.params.chatId}:`, error); res.status(404).json(null); } });
app.post('/api/chats', async (req, res) => { try { let { chatId, data } = req.body; chatId = sanitizeChatId(chatId); const filePath = path.join(CHATS_DIR, `${chatId}.json`); await fs.writeFile(filePath, JSON.stringify(data, null, 2)); res.json({ success: true }); } catch (error) { console.error(`Could not save chat:`, error); res.status(500).json({ success: false, error: error.message }); } });
app.put('/api/chats/:chatId/rename', async (req, res) => { try { const chatId = sanitizeChatId(req.params.chatId); const { newTitle } = req.body; const filePath = path.join(CHATS_DIR, `${chatId}.json`); const content = JSON.parse(await fs.readFile(filePath, 'utf-8')); content.title = newTitle; await fs.writeFile(filePath, JSON.stringify(content, null, 2)); res.json({ success: true }); } catch (error) { console.error(`Could not rename chat ${req.params.chatId}:`, error); res.status(500).json({ success: false, error: error.message }); } });
app.delete('/api/chats/:chatId', async (req, res) => { try { const chatId = sanitizeChatId(req.params.chatId); const filePath = path.join(CHATS_DIR, `${chatId}.json`); await fs.unlink(filePath); res.json({ success: true }); } catch (error) { if (error.code === 'ENOENT') { return res.json({ success: true }); } console.error(`Could not delete chat ${req.params.chatId}:`, error); res.status(500).json({ success: false, error: error.message }); } });

// --- Server Startup Logic ---
async function start() {
    await autoKillOllama();
    await setupStorage();
    
    if (await isOllamaRunning()) {
        console.error('Ollama is still running after a kill attempt. Please check permissions or stop it manually.');
        process.exit(1);
    }
    
    console.log('Ollama not found. Starting managed Ollama server...');
    try {
        startOllama();
        await checkOllamaReady();
    } catch (error) {
        console.error('Could not start the Ollama server. Please ensure Ollama is installed correctly and try again.', error);
        process.exit(1);
    }

    app.listen(PORT, async () => { // <-- MODIFIED: Made this function async
        const url = `http://localhost:${PORT}`;
        console.log(`\nLocal Gemini is running! Open this URL in your browser: ${url}`);
        
        // MODIFIED: Use the 'open' package for robust, cross-platform browser launching
        try {
            await open(url);
            console.log('Browser launch command issued successfully.');
        } catch(e) {
            console.error(`Failed to open browser automatically: ${e.message}`);
        }
    });
}

// --- Shutdown Hook (No changes in this section) ---
process.on('SIGINT', () => { console.log('\nShutting down...'); if (isManagedByApp && ollamaProcess && !ollamaProcess.killed) { console.log('Terminating managed Ollama process...'); killOllamaProcess(); } else { console.log('Not terminating externally managed Ollama process.'); } process.exit(0); });

start();
// --- END OF FILE server.js ---