import { existsSync } from 'node:fs';
import os from 'node:os';
import { detect as jdkInfo } from './jdk.js';
import { detectTitaniumSDKs } from './tisdk.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import chalk from 'chalk';
import { readFile } from 'node:fs/promises';

const { cyan } = chalk;

export async function detect(logger, config, cli, types = { all: true }) {
	const [
		os,
		node,
		npm,
		titanium,
		titaniumCLI,
		jdk,
		...platformData
	] = await Promise.all([
		(types.all || types.os) && osInfo(),
		(types.all || types.nodejs) && nodeInfo(),
		(types.all || types.nodejs) && npmInfo(),
		(types.all || types.titanium) && titaniumSDKInfo(config),
		(types.all || types.titanium) && titaniumCLIInfo(cli),
		(types.all || types.jdk) && jdkInfo(config),
		...Object.keys(cli.sdk?.platforms || {}).sort().map(async name => {
			const type = name === 'iphone' ? 'ios' : name;
			if (types.all || types[type]) {
				return await loadPlatformInfo(logger, cli.sdk.platforms[name], config);
			}
		})
	]);

	const data = {
		os,
		node,
		npm,
		titanium,
		titaniumCLI,
		jdk
	};

	const platformInfo = [];

	for (const pd of platformData) {
		if (pd) {
			Object.assign(data, pd.data);
			platformInfo.push(pd.info);
		}
	}

	return {
		data,
		platformInfo
	};
}

async function loadPlatformInfo(logger, platform, config) {
	try {
		const file = join(platform.path, 'cli/lib/info.js');
		if (!existsSync(file)) {
			return;
		}

		const fileUrl = pathToFileURL(file);
		logger?.trace(`Importing ${cyan(fileUrl)}`);
		const mod = await import(fileUrl);
		const dummy = {
			data: null,
			issues: []
		};

		return await new Promise((resolve, reject) => {
			mod.detect.call(dummy, null, config, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve({
						info: {
							name: mod.name,
							title: mod.title,
							render: mod.render,
						},
						data
					});
				}
			});
		});
	} catch (e) {
		logger?.warn('Failed to load platform info:');
		logger?.warn(e);
	}
}

async function osInfo() {
	let name = process.platform;
	let version = '?';
	let m;
	const { $ } = await import('execa');

	if (name === 'darwin') {
		const { stdout } = await $`sw_vers`;
		if (m = stdout.match(/ProductName:\s+(.+)/i)) {
			name = m[1];
		}
		if (m = stdout.match(/ProductVersion:\s+(.+)/i)) {
			version = m[1];
		}
	} else if (name === 'linux') {
		name = 'GNU/Linux';
		if (existsSync('/etc/lsb-release')) {
			const s = await readFile('/etc/lsb-release', 'utf-8');
			if (m = s.match(/DISTRIB_DESCRIPTION=(.+)/i)) {
				name = m[1].replaceAll('"', '');
			}
			if (m = s.match(/DISTRIB_RELEASE=(.+)/i)) {
				name = m[1].replaceAll('"', '');
			}
		} else if (existsSync('/etc/system-release')) {
			const parts = (await readFile('/etc/system-release', 'utf-8')).split(' ');
			if (parts.length) {
				name = parts[0];
			}
			if (parts.length > 2) {
				version = parts[2];
			}
		}
	} else {
		const { stdout } = await $`wmic os get Caption,Version`;
		[name, version] = stdout.split('\n')[1].split(/ {2,}/);
	}

	return {
		name,
		version,
		architecture: `${process.arch.includes('64') ? 64 : 32}-bit`,
		numcpus: os.cpus().length,
		memory: os.totalmem()
	};
}

async function nodeInfo() {
	return {
		version: process.versions.node
	};
}

async function npmInfo() {
	const { $ } = await import('execa');
	const { stdout: version } = await $`npm --version`;
	return {
		version
	};
}

async function titaniumSDKInfo(config) {
	const { sdks } = await detectTitaniumSDKs(config);
	const results = {};

	for (const sdk of sdks) {
		results[sdk.name] = {
			version: sdk.version,
			path: sdk.path,
			platforms: Object.keys(sdk.platforms),
			githash: sdk.githash,
			timestamp: sdk.timestamp
		};
	}

	return results;
}

async function titaniumCLIInfo(cli) {
	return {
		version: cli.version
	};
}
