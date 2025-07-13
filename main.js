// --- START OF FILE main.js ---

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises; // CHANGED: Using the promises API for async operations
const { spawn } = require('child_process');
const http = require('http');

let ollamaProcess = null;
let isManagedByApp = false; // FIX: Flag to track if this app started the process

// FIX: New function to check if Ollama is already running.
function isOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434', (res) => {
      res.resume(); // Consume response data to free up memory
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { // Quick timeout, 1s is plenty
        req.destroy();
        resolve(false);
    });
  });
}

// FIX: Improved startOllama with PATH fallback
function startOllama() {
  const platform = process.platform;
  const command = 'ollama';
  const args = ['serve'];
  let specificPath;

  if (platform === 'win32') {
    specificPath = path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
  } else if (platform === 'darwin') {
    specificPath = '/usr/local/bin/ollama';
  } else {
    specificPath = '/usr/bin/ollama';
  }

  // Try spawning from PATH first for non-windows
  if (platform !== 'win32') {
      ollamaProcess = spawn(command, args, { detached: false }); // Try system PATH
      ollamaProcess.on('error', (err) => {
          console.log('Could not find "ollama" in PATH, trying default location...');
          // If it fails (e.g., not in PATH), try the specific hardcoded path
          ollamaProcess = spawn(specificPath, args);
          setupOllamaListeners();
      });
  } else {
      // For Windows, directly use the specific path
      ollamaProcess = spawn(specificPath, args);
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

const CHATS_DIR = path.join(app.getPath('userData'), 'chats');

async function setupStorage() {
    // CHANGED: mkdir is async and handles existence check.
    try {
        await fs.mkdir(CHATS_DIR, { recursive: true });
        console.log(`Chats directory created or already exists at: ${CHATS_DIR}`);
    } catch (error) {
        console.error("Failed to create chats directory:", error);
    }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Local Gemini',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1f1f1f',
      symbolColor: '#c4c7c5'
    },
    backgroundColor: '#1f1f1f'
  });

  mainWindow.loadFile('index.html');
  
  // DEV MODE: Automatically open Developer Tools
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  await setupStorage();
  setupIpcHandlers();

  // FIX: Implement robust process management
  if (await isOllamaRunning()) {
    console.log('Ollama is already running. Connecting to existing instance.');
    createWindow();
  } else {
    console.log('Ollama not found. Starting managed Ollama server...');
    startOllama();
    try {
      await checkOllamaReady();
      createWindow();
    } catch (error) {
      dialog.showErrorBox('Ollama Server Failed', 'Could not start the Ollama server. Please ensure Ollama is installed correctly and try again.');
      app.quit();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // FIX: Only kill the process if this app instance started it
  if (isManagedByApp && ollamaProcess && !ollamaProcess.killed) {
    console.log('Terminating managed Ollama process...');
    ollamaProcess.kill();
  } else {
    console.log('Not terminating externally managed Ollama process.');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers with Async File Operations ---
function setupIpcHandlers() {
    ipcMain.handle('get-chats', async () => {
        try {
            // CHANGED: Use async readdir
            const files = (await fs.readdir(CHATS_DIR)).filter(file => file.endsWith('.json'));
            const chats = {};
            // Using Promise.all for parallel reads
            await Promise.all(files.map(async file => {
                const filePath = path.join(CHATS_DIR, file);
                try {
                    // CHANGED: Use async readFile
                    const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
                    const chatId = path.basename(file, '.json');
                    chats[chatId] = { title: content.title };
                } catch (e) {
                    console.error(`Could not read or parse chat file: ${file}`, e);
                }
            }));
            return chats;
        } catch (error) {
            console.error("Could not get chats:", error);
            return {};
        }
    });

    ipcMain.handle('load-chat', async (event, chatId) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            // CHANGED: Use async readFile
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`Could not load chat ${chatId}:`, error);
            return null;
        }
    });

    ipcMain.handle('save-chat', async (event, chatData) => {
        const { chatId, data } = chatData;
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            // CHANGED: Use async writeFile
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error) {
            console.error(`Could not save chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('rename-chat', async (event, chatId, newTitle) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            // CHANGED: Use async readFile/writeFile
            const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
            content.title = newTitle;
            await fs.writeFile(filePath, JSON.stringify(content, null, 2));
            return { success: true };
        } catch (error) {
            console.error(`Could not rename chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-chat', async (event, chatId) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            // CHANGED: Use async unlink
            await fs.unlink(filePath);
            return { success: true };
        } catch (error) {
            if (error.code === 'ENOENT') { // File doesn't exist, which is fine.
              return { success: true };
            }
            console.error(`Could not delete chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.on('set-theme', (event, theme) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            const isLight = theme === 'light';
            window.setTitleBarOverlay({
                color: isLight ? '#ffffff' : '#1f1f1f',
                symbolColor: isLight ? '#5f6368' : '#c4c7c5'
            });
        }
    });
}