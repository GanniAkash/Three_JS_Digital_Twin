import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Critical for Electron to load assets correctly in production
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets', // Where assets will be placed
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: undefined, // Ensures assets are properly included
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true // Handle mixed CJS/ESM modules
    }
  },
  // Handle Node.js built-in modules properly
  optimizeDeps: {
    exclude: ['electron'],
    include: ['three'] // Explicitly include Three.js for better optimization
  },
  server: {
    strictPort: true,
    port: 5173,
    host: true // Listen on all addresses
  },
  // Define env variables to detect Electron vs web environment
  define: {
    'process.env.IS_ELECTRON': JSON.stringify(process.env.NODE_ENV !== undefined)
  }
})