import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev server is launched via a Windows 8.3 short path (the real path
    // has spaces, which breaks npm --prefix argument passing), so Vite's
    // resolved root doesn't string-match the long path it also sees in
    // requests — fs.strict would otherwise 403 everything.
    fs: {
      strict: false,
    },
  },
})
