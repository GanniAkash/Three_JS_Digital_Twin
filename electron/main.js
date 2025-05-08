// Use CommonJS instead of ES modules for Electron main process
const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // First, register file protocol handler for serving local files correctly
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = decodeURI(request.url.replace('file:///', ''));
    callback(pathname);
  });

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Check if we're in development or production
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
  
  console.log(`Running in ${isDev ? 'development' : 'production'} mode`);
  console.log(`Current directory: ${__dirname}`);
  
  // Load the app - either from Vite dev server or from built files
  if (isDev) {
    // In development: load from vite dev server
    mainWindow.loadURL('http://localhost:5173');
    console.log('Loading from Vite dev server at http://localhost:5173');
    
    // Open DevTools automatically in development mode
    mainWindow.webContents.openDevTools();
  } else {
    // In production: load the built HTML file
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log(`Loading from local file: ${indexPath}`);
    
    // Check if the file exists
    if (fs.existsSync(indexPath)) {
      const startUrl = url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true
      });
      mainWindow.loadURL(startUrl);
    } else {
      console.error(`Error: Could not find ${indexPath}`);
      mainWindow.loadFile(path.join(__dirname, 'error.html'));
    }
  }
  
  // Uncomment to open DevTools by default
  // mainWindow.webContents.openDevTools();

  // Handle window being closed
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function () {
  // On macOS applications keep their menu bar active until the user quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On macOS re-create a window when dock icon is clicked and no windows are open
  if (mainWindow === null) {
    createWindow();
  }
});
