import { build } from 'esbuild'

await build({
	entryPoints: ['./src/**/*'],
	outdir: './dist',
	format: 'esm',
	target: 'node18',
	platform: 'node',
	minify: true
});
