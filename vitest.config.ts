import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts'],exclude:['tests/**/*.browser.ts'],testTimeout:30000,hookTimeout:30000,pool:'forks',maxWorkers:2}});
