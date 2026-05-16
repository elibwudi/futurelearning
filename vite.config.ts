
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
// trigger restart
  plugins: [react()],
  server: {
    port: 3008,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // Explicitly use 127.0.0.1 to avoid IPv4/IPv6 ambiguity
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        timeout: 0, // Disable timeout for large uploads
        proxyTimeout: 0, // Disable proxy timeout
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        timeout: 0, // Disable timeout for large file fetches
      }
    }
  }
});
