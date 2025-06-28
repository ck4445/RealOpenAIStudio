// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // --- From Main to Renderer ---
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  
  // --- From Renderer to Main (and back) ---
  getChats: () => ipcRenderer.invoke('get-chats'),
  loadChat: (chatId) => ipcRenderer.invoke('load-chat', chatId),
  saveChat: (chatData) => ipcRenderer.invoke('save-chat', chatData),
  renameChat: (chatId, newTitle) => ipcRenderer.invoke('rename-chat', chatId, newTitle),
  deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
});