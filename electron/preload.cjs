const { contextBridge, ipcRenderer } = require("electron");

// The renderer never reads the encrypted token. It can only ask the main
// process to store or clear it after a successful desktop login.
contextBridge.exposeInMainWorld("nexaDesktop", {
  saveSession: (token) => ipcRenderer.invoke("nexa-session:save", String(token || "")),
  clearSession: () => ipcRenderer.invoke("nexa-session:clear")
});
