const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('__UOMA_ELECTRON_BRIDGE__', {
  fetch (url, options) {
    return new Promise((resolve) => {
      ipcRenderer.invoke('fetch', {
        url,
        options
      }).then(resolve)
    })
  },
  setAttr (key, value) {
    ipcRenderer.send('setAttr', {
      key,
      value
    })
  }
})

contextBridge.exposeInMainWorld('__UOMA_ELECTRON__', true)
