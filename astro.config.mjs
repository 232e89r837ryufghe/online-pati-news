// @ts-check
import { defineConfig } from 'astro/config';

// Reverting to Static Output for maximum production compatibility and reliability
// https://astro.build/config
export default defineConfig({
  site: 'https://onlinepatinews.com',
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/admin': {
          target: 'http://localhost:8787',
          changeOrigin: true
        },
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true
        },
        '/cdn': {
          target: 'http://localhost:8787',
          changeOrigin: true
        }
      }
    }
  }
});