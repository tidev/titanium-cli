import { CLI } from './cli.js';
import chalk from 'chalk';
import { TiError } from './util/tierror.js';

const cli = new CLI();

try {
	await cli.go();
} catch (e) {
	cli.logger.bannerEnabled(true);
	cli.logger.skipBanner(false);
	cli.logger.banner();
	console.error(`${
		e.before ? `${e.before}\n\n` : ''
	}${
		chalk.red((e instanceof TiError ? `Error: ${e.message}` : e.stack).trim())
	}\n${
		e.after ? `\n${e.after}\n` : ''
	}`);
	if (!(e instanceof TiError) || e.showHelp) {
		cli.command?.help();
	}
	process.exit(1);
}
