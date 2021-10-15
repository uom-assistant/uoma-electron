const { app, BrowserWindow, BrowserView, Menu, nativeTheme, ipcMain, shell } = require('electron')
const contextMenu = require('electron-context-menu')
const { is, enforceMacOSAppLocation } = require('electron-util')
const path = require('path')
const { evaluate } = require('mathjs')

const handleApi = require('./handleApi')

const locales = require('./locale/locale.json')

let mainWindow
const webViews = {}

/**
 * Translate string based on the given locale
 * @param {string} key translation string key
 * @param {string} locale locale
 * @returns translated string
 */
const $t = (key, locale) => {
  let finalLocale = locale
  // Fallback to en
  if (!locales[locale]) {
    finalLocale = 'en'
  }

  if (locales[finalLocale]) {
    if (is.macos && (locales[finalLocale][`${key}__macos`] || locales.en[`${key}__macos`])) {
      return locales[finalLocale][`${key}__macos`] || locales.en[`${key}__macos`]
    }
    return locales[finalLocale][key] || (locales.en[key] || key)
  }
  return key
}

class WebView {
  /**
   * BrowserView instance
   */
  instance = null

  /**
   * WebView name
   */
  name = null

  /**
   * Enable auto-resizing or not
   */
  allowAutoResize = true

  /**
   * WebView bounds
   */
  bounds = { x: 0, y: 0, width: 0, height: 0 }

  /**
   * WebView flex bounds (auto-resize)
   */
  flexBounds = { x: '0', y: '0', width: '0', height: '0' }

  /**
   * WebView message handlers
   */
  handlers = []

  /**
   * WebView webContents
   */
  webContents = null

  /**
   * WebView language
   */
  language = 'en'

  /**
   * WebView context menu disposer
   */
  disposeContextMenu = null

  /**
   * Create a new WebView
   * @param {string} name WebView name
   * @param {Electron.WebPreferences} options WebView options
   */
  constructor (name, options) {
    this.instance = new BrowserView({ webPreferences: options })
    this.name = name

    if (webViews[name]) {
      webViews[name].destroy()
    }

    webViews[name] = this
    mainWindow.addBrowserView(this.instance)

    this.instance.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    this.instance.isDestroyed = () => false
    this.instance.off = (name, handler) => this.webContents.off(name, handler)

    this.webContents = this.instance.webContents
  }

  /**
   * Translate the flex bounds to real pixel bounds
   * @param { { x: number | string, y: number | string, width: number | string, height: number | string } } flexBounds flex bounds
   * @param { [number, number] } contentSize window's contentSize
   * @returns pixel bounds
   */
  static transformFlexBounds (flexBounds, contentSize) {
    const result = { x: 0, y: 0, width: 0, height: 0 }
    for (const key of ['x', 'y', 'width', 'height']) {
      if (flexBounds[key] !== undefined) {
        if (typeof flexBounds[key] === 'number') {
          result[key] = Math.round(flexBounds[key])
          continue
        } else if (typeof flexBounds[key] === 'string' && /^\d+px$/.test(flexBounds[key])) {
          result[key] = parseInt(flexBounds[key], 10)
          continue
        } else if (typeof flexBounds[key] === 'string' && /^\d+%$/.test(flexBounds[key])) {
          result[key] = Math.round(contentSize[(key === 'x' || key === 'width') ? 0 : 1] * parseInt(flexBounds[key], 10) / 100)
          continue
        } else if (typeof flexBounds[key] === 'string' && /^calc\(.+\)$/.test(flexBounds[key])) {
          const value = evaluate(flexBounds[key].slice(5, -1).replace(/(\d+)px/g, '$1').replace(/(\d+)%/g, (match, percent) => {
            return `${Math.round(contentSize[(key === 'x' || key === 'width') ? 0 : 1] * parseInt(percent, 10) / 100)}`
          }))
          if (typeof value === 'number') {
            result[key] = value
          }
          continue
        }
      }
    }
    return result
  }

  /**
   * Destroy this WebView and remove all related message listeners and handlers
   */
  destroy () {
    for (const handler of this.handlers) {
      if (handler.type === 'on') {
        ipcMain.removeAllListeners(handler.name)
      } else {
        ipcMain.removeHandler(handler.name)
      }
    }
    this.setBackgroundColor('#00000000')
    this.instance.webContents.destroy()
    this.instance.isDestroyed = () => true
    delete this.instance
    delete webViews[this.name]
  }

  /**
   * Add a message listener
   * @param {string} name message channel
   * @param { (event: Electron.IpcMainEvent, message: any) => void } handler message callback
   * @returns this WebView instance
   */
  on (name, handler) {
    for (const webView of Object.values(webViews)) {
      if (webView.handlers.find((item) => item.type === 'on' && item.name === name)) {
        webView.off(name)
        break
      }
    }

    ipcMain.on(name, handler)

    this.handlers.push({
      type: 'on',
      name
    })

    return this
  }

  /**
   * Remove a message listener
   * @param {string} name message channel
   * @returns this WebView instance
   */
  off (name) {
    const index = this.handlers.findIndex((item) => item.type === 'on' && item.name === name)

    if (index !== -1) {
      ipcMain.removeAllListeners(name)
      this.handlers.slice(index, 1)
    }

    return this
  }

  /**
   * Add a message handler
   * @param {string} name message channel
   * @param { (event: Electron.IpcMainEvent, message: any) => void } handler message handler
   * @returns this WebView instance
   */
  handle (name, handler) {
    for (const webView of Object.values(webViews)) {
      if (webView.handlers.find((item) => item.type === 'handle' && item.name === name)) {
        webView.unhandle(name)
        break
      }
    }

    ipcMain.handle(name, handler)

    this.handlers.push({
      type: 'handle',
      name
    })

    return this
  }

  /**
   * Remove a message handler
   * @param {string} name message channel
   * @returns this WebView instance
   */
  unhandle (name) {
    const index = this.handlers.findIndex((item) => item.type === 'handle' && item.name === name)

    if (index !== -1) {
      ipcMain.removeHandler(name)
      this.handlers.slice(index, 1)
    }

    return this
  }

  /**
   * Set WebView bounds
   * @param { { x: number, y: number, width: number, height: number } } bounds WebView bounds in px
   * @returns this WebView instance
   */
  setBounds (bounds) {
    // Only update bounds when the bounds is different with the previous one. Electron has a bug here.
    // See https://github.com/electron/electron/issues/19536
    if (this.bounds.x !== bounds.x || this.bounds.y !== bounds.y || this.bounds.width !== bounds.width || this.bounds.height !== bounds.height) {
      this.instance.setBounds(bounds)
    }
    this.bounds = bounds
    return this
  }

  /**
   * Set WebView flex bounds and update its real bounds
   * @param { { x: number | string, y: number | string, width: number | string, height: number | string } } flexBounds flex bounds. Just like CSS, supports px, % and `calc()`. For `calc()`, see https://mathjs.org/
   * @returns this WebView instance
   */
  setFlexBounds (flexBounds) {
    this.flexBounds = flexBounds
    this.setBounds(WebView.transformFlexBounds(flexBounds, mainWindow.getContentSize()))
    return this
  }

  /**
   * Update WebView bounds
   * @param { [number, number] } contentSize window's content size
   * @returns this WebView instance
   */
  updateBounds (contentSize = false) {
    this.setBounds(WebView.transformFlexBounds(this.flexBounds, contentSize || mainWindow.getContentSize()))
    return this
  }

  /**
   * Set whether to enable auto-resizing
   * @param {boolean} autoResize whether to enable auto-resizing
   * @returns this WebView instance
   */
  setAutoResize (autoResize = true) {
    this.allowAutoResize = autoResize
    return this
  }

  /**
   * set WebView's background color
   * @param {string} color background color
   * @returns this WebView instance
   */
  setBackgroundColor (color) {
    this.instance.setBackgroundColor(color)
    return this
  }

  /**
   * Load file to this WebView
   * @param {string} filePath file path
   * @returns this WebView instance
   */
  loadFile (filePath) {
    this.webContents.loadFile(filePath)
    return this
  }

  /**
   * Load URL
   * @param {string} url URL
   * @returns this WebView instance
   */
  loadURL (url) {
    this.webContents.loadURL(url)
    return this
  }

  /**
   * Get current loaded URL
   * @returns current loaded URL
   */
  getURL () {
    return this.webContents.getURL()
  }

  /**
   * Enable context menu
   * @param {contextMenu.Options} options context menu options
   * @see https://github.com/sindresorhus/electron-context-menu
   * @returns this WebView instance
   */
  setMenu (options) {
    if (this.disposeContextMenu !== null) {
      // If context menu is alredy set, dispose it
      this.disposeContextMenu()
      this.disposeContextMenu = null
    }

    options.window = this.instance
    options.labels = {
      learnSpelling: '',
      copy: $t('copy', this.language),
      cut: $t('cut', this.language),
      paste: $t('paste', this.language),
      saveImageAs: $t('saveImageAs', this.language),
      lookUpSelection: $t('lookUpSelection', this.language),
      copyLink: $t('copyLink', this.language),
      copyImage: $t('copyImage', this.language)
    }

    this.disposeContextMenu = contextMenu(options)
    return this
  }
}

async function createWindow () {
  // Main window
  mainWindow = new BrowserWindow({
    title: 'UoM Assistant',
    width: 1280,
    height: 950,
    minWidth: 400,
    minHeight: 550,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: false,
      devTools: false,
      webSecurity: true,
      contextIsolation: true
    }
  })

  Menu.setApplicationMenu(null)

  mainWindow.on('resize', () => {
    setTimeout(() => {
      const size = mainWindow.getContentSize()
      Object.values(webViews).filter((webView) => webView.allowAutoResize).forEach((webView) => webView.updateBounds(size))
    }, 0)
  })

  // Main view
  new WebView('main', {
    nodeIntegration: false,
    webSecurity: true,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  }).setMenu({
    showSearchWithGoogle: false,
    showInspectElement: false,
    showSaveImageAs: true,
    showCopyImage: true
  }).setFlexBounds({
    x: 0,
    y: 0,
    width: '100%',
    height: '100%'
  }).handle('fetch', async (event, { url, options }) => {
    return await handleApi(url, options)
  }).on('setAttr', (event, { key, value }) => {
    if (key === 'language') {
      webViews.main.language = value
      // Reset context menu
      webViews.main.setMenu({
        showSearchWithGoogle: false,
        showInspectElement: false,
        showSaveImageAs: true,
        showCopyImage: true
      })
    } else if (key === 'theme') {
      // Could be light, dark or system
      nativeTheme.themeSource = value
    }
  }).setBackgroundColor('#FFFFFF').loadURL('https://uoma.axton.im')
}

app.whenReady().then(() => {
  if (is.macos) {
    enforceMacOSAppLocation()
  }

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
