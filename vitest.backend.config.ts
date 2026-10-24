import {defineConfig} from 'vitest/config';
export default defineConfig({test: {include: ['tests/backend-smoke.test.ts'], environment: 'node'}});
