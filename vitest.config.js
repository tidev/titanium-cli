import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		allowOnly: true,
		coverage: {
			include: ['src/**/*.js'],
			reporter: ['html', 'lcov', 'text'],
		},
		env: {
			TI_CLI_SKIP_ENV_PATHS: '1',
		},
		environment: 'node',
		globals: false,
		include: ['test/**/*.test.js'],
		reporters: ['verbose'],
		silent: false,
		watch: false,
	},
});
