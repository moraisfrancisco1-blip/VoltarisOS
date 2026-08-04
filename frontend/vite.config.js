import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Obfuscates the production bundle so business logic (dispatch/scoring
    // thresholds, pricing formulas, UI structure) isn't trivially readable
    // in browser devtools. Skipped in dev for fast HMR + debuggable builds.
    mode === 'production' && obfuscator({
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.3,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        splitStrings: true,
        splitStringsChunkLength: 8,
        selfDefending: true,
        disableConsoleOutput: true,
      },
    }),
  ].filter(Boolean),
  server: {
    port: 4200,
    host: '0.0.0.0',
    allowedHosts: 'all',
    hmr: { overlay: false },
  },
  build: {
    minify: 'terser',
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'THIS_IS_UNDEFINED') return
        warn(warning)
      }
    }
  }
}))
