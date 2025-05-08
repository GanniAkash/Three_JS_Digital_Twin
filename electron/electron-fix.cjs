// This fixes the "ESM vs CommonJS" issue that often occurs in Electron projects
// This file is CommonJS (.cjs extension) while the rest of the project can remain ESM

// This is a CommonJS file used for Electron
module.exports = {
  // You can add common functions or utilities used by Electron here
  isElectron: () => {
    return process.type === 'renderer' || 
          (process.type === 'browser' && process.versions && process.versions.electron);
  }
};
