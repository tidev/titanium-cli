import { existsSync } from 'node:fs';
import { readdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { expand } from './expand.js';
import which from 'which';

const exe = process.platform === 'win32' ? '.exe' : '';

/**
 * Detects if Java and the JDK are installed.
 * @param {Object} [config] - The CLI configuration
 * @returns {Promise}
 */
export async function detect(config) {
	let javaHome = config.get('java.home', process.env.JAVA_HOME) || null;
	const jdkPaths = [];
	const requiredTools = ['java', 'javac', 'keytool'];
	const executables = {};
	const results = {
		jdks: {},
		home: null,
		version: null,
		build: null,
		executables: executables,
		issues: []
	};
	const { $ } = await import('execa');

	// sanity check the java home
	if (javaHome) {
		javaHome = expand(javaHome);
		if (existsSync(javaHome) && isJDK(javaHome)) {
			jdkPaths.push(javaHome);
		}
		results.home = javaHome;
	}

	if (process.platform === 'linux') {
		try {
			let p = await which('javac');
			p = dirname(dirname(p));
			if (!jdkPaths.includes(p) && isJDK(p)) {
				jdkPaths.push(p);
			}
		} catch {}
	} else if (process.platform === 'darwin') {
		try {
			const { stdout } = await $`/usr/libexec/java_home`;
			const p = stdout.trim();
			if (p && !jdkPaths.includes(p) && isJDK(p)) {
				jdkPaths.push(p);
			}
		} catch {}

		try {
			let p = await which('javac');
			p = await realpath(dirname(dirname(p)));
			if (!jdkPaths.includes(p) && isJDK(p)) {
				jdkPaths.push(p);
			}
		} catch {}

		const dirs = [
			'/Library/Java/JavaVirtualMachines',
			'/System/Library/Java/JavaVirtualMachines'
		];
		for (const jvmPath of dirs) {
			if (existsSync(jvmPath)) {
				for (const name of await readdir(jvmPath)) {
					const p = join(jvmPath, name, 'Contents', 'Home');
					if (!jdkPaths.includes(p) && isJDK(p)) {
						jdkPaths.push(p);
					}
				}
			}
		}
	} else if (process.platform === 'win32') {
		const dirs = ['%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%ProgramW6432%', '~'];
		for (let dir of dirs) {
			dir = expand(dir);
			if (existsSync(dir)) {
				for (const name of await readdir(dir)) {
					const subdir = join(dir, name);
					if (isJDK(subdir) && !jdkPaths.includes(subdir)) {
						jdkPaths.push(subdir);
					}
				}
			}
		}
	}

	await Promise.all(jdkPaths.map(async home => {
		const jdk = {
			home: home,
			version: null,
			build: null,
			executables: {}
		};
		const missingTools = [];

		for (const cmd of requiredTools) {
			const p = join(home, `bin/${cmd}${exe}`);
			if (existsSync(p)) {
				jdk.executables[cmd] = await realpath(p);
			} else {
				missingTools.push(cmd);
			}
		}

		if (missingTools.length) {
			results.issues.push({
				id: 'JDK_MISSING_PROGRAMS',
				type: 'warning',
				message: `JDK (Java Development Kit) at ${home} missing required programs: __${missingTools.join(', ')}__
${process.env.JAVA_HOME
		? `Please verify your __JAVA_HOME__ environment variable is correctly set to the JDK install location\n__JAVA_HOME__ is currently set to "${process.env.JAVA_HOME}".`
		: 'Please set the __JAVA_HOME__ environment variable to the JDK install location and not the JRE (Java Runtime Environment).'}
The __JAVA_HOME__ environment variable must point to the JDK and not the JRE (Java Runtime Environment).
You may want to reinstall the JDK by downloading it from __https://www.oracle.com/java/technologies/downloads/__
or  __https://jdk.java.net/archive/__.`
			});
			return;
		}

		let arch = '32bit';
		let result;
		try {
			result = await $`${jdk.executables.javac} -version -d64`;
			arch = '64bit';
		} catch {
			result = await $`${jdk.executables.javac} -version`;
		}

		const re = /^javac (.+?)(?:_(.+))?$/;
		let m = result?.stderr?.trim().match(re) || result?.stdout?.trim().match(re);
		if (m) {
			let name = m[1];

			jdk.architecture = arch;
			jdk.version = m[1];
			jdk.build = m[2];

			if (jdk.build) {
				name += `_${jdk.build}`;
			} else {
				const { stderr } = await $`${jdk.executables.java} -version`;
				m = stderr.trim().match(/\(build .+?\+(\d+(-[-a-zA-Z0-9.]+)?)\)/);
				if (m) {
					jdk.build = m[1];
					name += `_${m[1]}`;
				}
			}

			results.jdks[name] = jdk;

			if (results.version === null) {
				Object.assign(results, jdk);
			}
		}
	}));

	if (results.version === null) {
		results.issues.push({
			id: 'JDK_NOT_INSTALLED',
			type: 'error',
			message: `JDK (Java Development Kit) not installed.
If you already have installed the JDK, verify your __JAVA_HOME__ environment variable is correctly set.
The JDK is required for Titanium and must be manually downloaded and installed from __https://www.oracle.com/java/technologies/downloads/__
or __https://jdk.java.net/archive/__`
		});
	}

	return results;
}

function isJDK(dir) {
	if (!existsSync(join(dir, `bin/javac${exe}`))) {
		return;
	}

	// try to find the jvm lib
	let libjvmLocations = [];

	if (process.platform === 'linux') {
		if (process.arch === 'x64') {
			libjvmLocations = [
				'lib/amd64/client/libjvm.so',
				'lib/amd64/server/libjvm.so',
				'jre/lib/amd64/client/libjvm.so',
				'jre/lib/amd64/server/libjvm.so',
				'lib/server/libjvm.so'
			];
		} else {
			libjvmLocations = [
				'lib/i386/client/libjvm.so',
				'lib/i386/server/libjvm.so',
				'jre/lib/i386/client/libjvm.so',
				'jre/lib/i386/server/libjvm.so'
			];
		}
	} else if (process.platform === 'darwin') {
		libjvmLocations = [
			'jre/lib/server/libjvm.dylib',
			'../Libraries/libjvm.dylib',
			'lib/server/libjvm.dylib'
		];
	} else if (process.platform === 'win32') {
		libjvmLocations = [
			'jre/bin/server/jvm.dll',
			'jre/bin/client/jvm.dll',
			'bin/server/jvm.dll'
		];
	}

	return libjvmLocations.some(p => existsSync(resolve(dir, p)));
}
