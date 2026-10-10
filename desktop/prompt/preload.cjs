const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptDialog', {
  answer: (value) => ipcRenderer.send('story-mapper:prompt-answer', typeof value === 'string' ? value : null),
});
