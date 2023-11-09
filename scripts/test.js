import { execa } from 'execa';
import { glob } from 'glob';
import { basename, join } from 'node:path';

let cover = false;
let only = false;

const argv = process.argv
	.slice(2)
	.map(arg => {
		if (arg === '--coverage') {
			cover = true;
		} else if (arg === '--only') {
			only = true;
		} else {
			return arg;
		}
	})
	.filter(Boolean);

const args = [];

if (cover) {
	args.push(
		join('node_modules', 'c8', 'bin', 'c8.js'),
		process.execPath
	);
}

let tests = await glob([
	'./test/**/*.test.js'
]);
tests.sort();
if (argv.length) {
	tests = tests.filter(file => {
		const filename = basename(file);
		return argv.some(filter => filename.includes(filter));
	});
}

if (!tests.length) {
	console.error('No tests found');
	process.exit(1);
}

args.push(
	`--test${only ? '-only' : ''}`,
	'--test-reporter=@reporters/github',
	'--test-reporter-destination=stdout',
	'--test-reporter=spec',
	'--test-reporter-destination=stdout',
	...tests
);

console.log(`\n> ${process.execPath} ${args.join(' ')}\n\n`);

await execa(
	process.execPath,
	args,
	{
		env: {
			TI_CLI_SKIP_ENV_PATHS: 1
		},
		stdio: 'inherit'
	}
);
