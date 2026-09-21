const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nomadDesktop', {
  platform: process.platform,
});
