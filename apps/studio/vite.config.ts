import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),plugins:[react()],server:{port:5173,strictPort:true,fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}},build:{outDir:'../../dist/studio',emptyOutDir:true}});
