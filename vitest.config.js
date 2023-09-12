import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			reporter: ['html', 'lcov', 'text']
		},
		environment: 'node',
		include: [
			'test/**/*.test.js'
		],
		watch: false
	}
});
