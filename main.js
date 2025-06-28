const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let ollamaProcess = null;

function startOllama() {
  const platform = process.platform;
  let commandPath;

  if (platform === 'win32') {
    commandPath = path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe');
  } else if (platform === 'darwin') {
    commandPath = '/usr/local/bin/ollama';
  } else {
    commandPath = '/usr/bin/ollama';
  }

  ollamaProcess = spawn(commandPath, ['serve']);
  ollamaProcess.stdout.on('data', (data) => console.log(`Ollama STDOUT: ${data}`));
  ollamaProcess.stderr.on('data', (data) => console.error(`Ollama STDERR: ${data}`));
  ollamaProcess.on('close', (code) => console.log(`Ollama process exited with code ${code}`));
  ollamaProcess.on('error', (err) => console.error('Failed to start Ollama process:', err));
}

function checkOllamaReady() {
  return new Promise((resolve, reject) => {
    const interval = 1000;
    const timeout = 20000;
    let elapsedTime = 0;
    const timer = setInterval(() => {
      const req = http.get('http://localhost:11434', (res) => {
        clearInterval(timer);
        console.log('Ollama server is ready.');
        resolve();
      });
      req.on('error', (err) => {
        elapsedTime += interval;
        if (elapsedTime >= timeout) {
          clearInterval(timer);
          console.error('Ollama server did not start in time.');
          reject(new Error('Ollama server timeout.'));
        }
      });
    }, interval);
  });
}

const CHATS_DIR = path.join(app.getPath('userData'), 'chats');

function setupStorage() {
    if (!fs.existsSync(CHATS_DIR)) {
        fs.mkdirSync(CHATS_DIR, { recursive: true });
        console.log(`Chats directory created at: ${CHATS_DIR}`);
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
      // Modern, secure Electron setup
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
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  setupStorage();
  setupIpcHandlers();

  console.log('Starting Ollama server...');
  startOllama();

  try {
    await checkOllamaReady();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Ollama Server Failed', 'The Ollama server could not be started. Please ensure Ollama is installed correctly and is not already running.');
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (ollamaProcess) {
    console.log('Terminating Ollama process...');
    ollamaProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers for File System Operations ---
function setupIpcHandlers() {
    ipcMain.handle('get-chats', async () => {
        try {
            const files = fs.readdirSync(CHATS_DIR).filter(file => file.endsWith('.json'));
            const chats = {};
            files.forEach(file => {
                const filePath = path.join(CHATS_DIR, file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const chatId = path.basename(file, '.json');
                chats[chatId] = { title: content.title };
            });
            return chats;
        } catch (error) {
            console.error("Could not get chats:", error);
            return {};
        }
    });

    ipcMain.handle('load-chat', async (event, chatId) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
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
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error) {
            console.error(`Could not save chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('rename-chat', async (event, chatId, newTitle) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            content.title = newTitle;
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            return { success: true };
        } catch (error) {
            console.error(`Could not rename chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-chat', async (event, chatId) => {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return { success: true };
        } catch (error) {
            console.error(`Could not delete chat ${chatId}:`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.on('set-theme', (event, theme) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        const isLight = theme === 'light';
        window.setTitleBarOverlay({
            color: isLight ? '#ffffff' : '#1f1f1f',
            symbolColor: isLight ? '#5f6368' : '#c4c7c5'
        });
    });
}