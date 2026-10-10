// Electron makes window.prompt() throw. The web app uses it to name new
// stories, so route it to a small modal dialog owned by the main process.
// sendSync keeps prompt() synchronous, as it is in a browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storyMapperDesktop', {
  prompt: (message, value) => ipcRenderer.sendSync('story-mapper:prompt', String(message ?? ''), String(value ?? '')),
});

contextBridge.executeInMainWorld({
  func: () => {
    window.prompt = (message, value) => window.storyMapperDesktop.prompt(message, value);
  },
});
