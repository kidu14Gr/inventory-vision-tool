import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // In development we proxy API requests to the deployed APIs to avoid CORS
    ...(mode === 'development' ? {
      proxy: {
        '/kafka': {
          target: 'https://kafka-api.ienetworks.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/kafka/, ''),
        },
        '/ml': {
          target: 'https://fastapi.ienetworks.co',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/ml/, ''),
        }
      }
    } : {})
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
