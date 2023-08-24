import { BusyIndicator } from '../util/busyindicator.js';
import { detect } from '../util/detect.js';
import chalk from 'chalk';
import wrapAnsi from 'wrap-ansi';

const { bold, cyan, gray, magenta, red, yellow } = chalk;
const typesList = ['all', 'os', 'nodejs', 'titanium', 'jdk', 'android', 'ios'];

/**
 * Returns the configuration for the info command.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @returns {Object} Info command configuration
 */
export function config(_logger, _config, _cli) {
	return {
		skipBanner: true,
		flags: {
			json: {
				desc: 'display info as json'
			}
		},
		options: {
			output: {
				abbr: 'o',
				default: 'report',
				hidden: true,
				values: ['report', 'json']
			},
			types: {
				abbr: 't',
				default: 'all',
				desc: 'information types to display; you may select one or more'
			}
		}
	};
}

/**
 * Displays information about the current system.
 * @param {Object} logger - The logger instance
 * @param {Object} config - The CLI config object
 * @param {CLI} cli - The CLI instance
 * @param {Function} finished - Callback when the command finishes
 */
export async function run(logger, config, cli) {
	let busy;
	const isJson = cli.argv.json || cli.argv.output === 'json';

	if (!isJson) {
		logger.skipBanner(false);
		logger.banner();
		if (!cli.argv.quiet && !!cli.argv['progress-bars']) {
			busy = new BusyIndicator();
			busy.start();
		}
	}

	// determine the types to display
	const types = {};
	let i = 0;
	const specifiedTypes = (cli.argv.types || 'all').toLowerCase().split(',');
	for (let t of specifiedTypes) {
		t = t.trim();
		if (typesList.indexOf(t) >= 0) {
			types[t] = ++i;
		}
	}
	if (i === 0) {
		types.all = 1;
	}

	let data;
	let platformInfo;
	try {
		({
			data,
			platformInfo
		} = await detect(logger, config, cli, types));
	} finally {
		busy?.stop();
	}

	if (isJson) {
		console.log(JSON.stringify(data, null, '\t'));
		process.exit(0);
	}

	let indent = 27;
	const sections = [];

	if (types.all || types.os) {
		sections.push(new Section({
			name: 'os',
			title: 'Operating System',
			render() {
				console.log(bold(this.title));
				console.log(`  ${'Name'.padEnd(indent)} = ${magenta(data.os.name)}`);
				console.log(`  ${'Version'.padEnd(indent)} = ${magenta(data.os.version)}`);
				console.log(`  ${'Architecture'.padEnd(indent)} = ${magenta(data.os.architecture)}`);
				console.log(`  ${'# CPUs'.padEnd(indent)} = ${magenta(data.os.numcpus)}`);
				console.log(`  ${'Memory'.padEnd(indent)} = ${magenta((data.os.memory / 1024 / 1024 / 1024).toFixed(1) + 'GB')}\n`);
			}
		}));
	}

	if (types.all || types.nodejs || types.npm) {
		sections.push(new Section({
			name: 'nodejs',
			title: 'Node.js',
			render() {
				console.log(bold(this.title));
				console.log(`  ${'Node.js Version'.padEnd(indent)} = ${magenta(data.node.version)}`);
				console.log(`  ${'npm Version'.padEnd(indent)} = ${magenta(data.npm.version)}\n`);
			}
		}));
	}

	if (types.all || types.titanium) {
		sections.push(new Section({
			name: 'titanium',
			title: 'Titanium CLI',
			render() {
				console.log(bold(this.title));
				console.log(`  ${'CLI Version'.padEnd(indent)} = ${magenta(data.titaniumCLI.version)}\n`);

				console.log(bold('Titanium SDKs'));
				const names = Object.keys(data.titanium);
				if (names.length) {
					for (const name of names.sort().reverse()) {
						const sdk = data.titanium[name];
						console.log(`  ${cyan(name)}`);
						console.log(`  ${'  Version'.padEnd(indent)} = ${magenta(sdk.version)}`);
						console.log(`  ${'  Install Location'.padEnd(indent)} = ${magenta(sdk.path)}`);
						console.log(`  ${'  Platforms'.padEnd(indent)} = ${magenta(sdk.platforms.join(', '))}`);
						console.log(`  ${'  git Hash'.padEnd(indent)} = ${magenta(sdk.githash || 'unknown')}`);
						console.log(`  ${'  git Timestamp'.padEnd(indent)} = ${magenta(sdk.timestamp || 'unknown')}\n`);
					}
				} else {
					console.log(`  ${gray('None')}\n`);
				}
			}
		}));
	}

	if (types.all || types.jdk) {
		sections.push(new Section({
			name: 'jdk',
			title: 'Java Development Kit',
			render() {
				console.log(bold(this.title));
				if (data.jdk.version) {
					console.log(`  ${'Version'.padEnd(indent)} = ${magenta(`${data.jdk.version}_${data.jdk.build}`)}`);
					console.log(`  ${'Java Home'.padEnd(indent)} = ${magenta(data.jdk.home)}\n`);
				} else {
					console.log(`  ${gray('Not found')}\n`);
				}
			}
		}));
	}

	for (const info of platformInfo) {
		sections.push(new Section({
			name: info.name,
			title: info.title,
			render() {
				const container = {
					data: data[info.name]
				};
				info.render.call(container, console, config, s => s.padEnd(indent), bold, magenta, red);
			}
		}));
	}

	if (process.platform === 'darwin' && (types.all || types.ios) && data.iosKeychains) {
		// the keychain names are the only left side label that isn't fixed length, so
		// if we're displaying ios info, find the longest keychain name
		for (const keychain of data.iosKeychains) {
			indent = max(indent, path.basename(keychain).length + 2);
		}
	}

	// render each section
	for (const section of sections) {
		section.render();
	}

	// render issues
	const withIssues = Object.entries(data).filter(([type, info]) => {
		return (types.all || types[type]) && info?.issues?.length;
	});

	if (withIssues.length) {
		for (const [type, info] of withIssues) {
			const section = sections.find(s => s.name === type);
			console.log(bold(`${section.title} Issues`));

			for (const issue of info.issues) {
				const msg = issue.message.split('\n\n').map(chunk => {
					return wrapAnsi(
						chunk
							.split('\n')
							.map(line => line.replace(/(__(.+?)__)/g, bold('$2')))
							.join('\n'),
						config.get('cli.width', 80),
						{ hard: true, trim: false }
					).replace(/\n/g, '\n     ') + '\n';
				}).join('\n     ');

				if (issue.type === 'error') {
					console.log(red(`  ${process.platform === 'win32' ? '\u00D7' : '\u2715'}  ${msg}`));
				} else if (issue.type === 'warning') {
					console.log(bold(yellow('  !  ')) + yellow(msg));
				} else {
					console.log(magenta(`  ${process.platform === 'win32' ? '*' : '\u25CF'}  ${msg}`));
				}
			}
		}
	} else {
		console.log(bold('Issues'));
		console.log('  No issues detected! Your development environment should be working perfectly!');
	}
}

class Section {
	constructor(opts) {
		this.name = opts.name;
		this.title = opts.title;
		this.data = null;
		this.issues = [];
		this.render = opts.render?.bind(this);
	}
}
