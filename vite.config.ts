import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '')
  return {
    base: command === 'build' ? '/Aether-Couriers/' : '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }
})
