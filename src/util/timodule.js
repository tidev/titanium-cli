import { arrayify } from './arrayify.js';
import { basename, dirname, join, resolve } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import chalk from 'chalk';
import * as version from './version.js';
import { extractZip } from './extract-zip.js';

const { cyan } = chalk;

const platformAliases = {
	ipad: 'ios',
	iphone: 'ios',
};

/**
 * Scans search paths for Titanium modules. This function will not scan any paths
 * other than the ones explicitly told to scan.
 *
 * @param {Object} searchPaths - An object of scopes to arrays of paths to search for Titanium modules.
 * @param {Object} config - The CLI config.
 * @param {Object} [logger] - A logger instance.
 * @returns {Promise<object>}
 */
export async function detect(searchPaths, config, logger) {
	const results = {};

	if (searchPaths && typeof searchPaths === 'object') {
		for (let [scope, paths] of Object.entries(searchPaths)) {
			results[scope] = {};
			for (const searchPath of arrayify(paths, true)) {
				results[scope] = await detectModules(searchPath, config, logger);
			}
		}
	}

	return results;
}

/**
 * Searches a directory for Titanium modules. If it encounters a zip file
 * that matches module zip filename pattern, it will automatically unzip it and
 * remove the zip file prior to detecting modules.
 *
 * @param {String} modulesDir - A path/dir to search for Titanium modules.
 * @param {Object} config - The CLI config.
 * @param {Object} [logger] - A logger instance.
 * @returns {Promise<object>}
 */
async function detectModules(modulesDir, config, logger) {
	const moduleRoot = resolve(modulesDir, '..');

	// make sure the module's parent dir (the root) exists
	if (!existsSync(moduleRoot)) {
		return {};
	}

	// auto-unzip zipped modules if we find them
	const fileNames = await readdir(moduleRoot);
	await Promise.all(fileNames.map(name => unzipIfNecessary(moduleRoot, name, logger)));

	if (!existsSync(modulesDir)) {
		return {};
	}

	logger?.trace(`Detecting modules in ${cyan(modulesDir)}`);

	const ignoreDirs = new RegExp(config.get('cli.ignoreDirs', '^(.svn|.git|.hg|.?[Cc][Vv][Ss]|.bzr)$'));
	const osNamesRegExp = /^osx|win32|linux$/;

	const subdirs = await readdir(modulesDir);
	const modules = await Promise.all(subdirs.map(platform => {
		return detectPlatformModules(modulesDir, platform, osNamesRegExp, ignoreDirs, logger);
	}));

	return convertArrayOfModulesToHierarchy(modules.flat());
}

/**
 * Automatically extracts a module zipfile if detect in module root dir.
 * @param {string} moduleRoot root directory where we store modules (parent of "modules" dir)
 * @param {string} name basename of zip file
 * @param {object} [logger] optional logger object
 * @return {Promise<void>}
 * @private
 */
async function unzipIfNecessary(moduleRoot, name, logger) {
	const zipRegExp = /^.+-.+?-.+?\.zip$/;
	const file = join(moduleRoot, name);

	if (!zipRegExp.test(name)) {
		return;
	}

	try {
		logger?.log(`Installing module: ${cyan(name)}`);
		await extractZip({
			file,
			dest: moduleRoot
		});
		unlinkSync(file);
	} catch (e) {
		logger?.error(`Failed to install module: ${e.message}`);
	}
}

/**
 * @param {string} modulesDir i.e. '~/Library/APplication Support/Titanium/modules'
 * @param {string} platform i.e. 'android' or 'iphone'
 * @param {RegExp} osNamesRegExp regexp used to skip certain folder names like 'win32' or 'osx'
 * @param {RegExp} ignoreDirs additional regexp used to filter directories
 * @param {object} [logger] optional logger object
 * @returns {Promise<object[]>}
 * @private
 */
async function detectPlatformModules(modulesDir, platform, osNamesRegExp, ignoreDirs, logger) {
	if (osNamesRegExp.test(platform) || ignoreDirs.test(platform)) {
		return [];
	}

	const platformDir = join(modulesDir, platform);
	try {
		const st = await stat(platformDir);
		if (!st.isDirectory()) {
			return [];
		}
	} catch (e) {
		// ignore if can't stat dir
		return [];
	}
	// ok, it's a valid platform dir!

	const moduleNameDirs = await readdir(platformDir);
	// here we gather modules per-platform, which gives us object[] for each, so use of Promise.all gives us
	// an array of object[], so we need to flatten it once gathered
	const modules = await Promise.all(moduleNameDirs.map(moduleName => {
		return detectModulesByPlatformAndName(platformDir, moduleName, ignoreDirs, logger);
	}));

	return modules.flat();
}

/**
 * @param {string} platformModulesDir i.e. '~/Library/Application Support/Titanium/modules/android'
 * @param {string} moduleName i.e. 'hyperloop'
 * @param {RegExp} ignoreDirs regexp used to filter directories traversed
 * @param {object} [logger] optional logger object
 * @returns {Promise<object[]>}
 * @private
 */
async function detectModulesByPlatformAndName(platformModulesDir, moduleName, ignoreDirs, logger) {
	if (ignoreDirs.test(moduleName)) {
		return [];
	}

	// loop through module names
	const modulePath = join(platformModulesDir, moduleName);
	try {
		const st = await stat(modulePath);
		if (!st.isDirectory()) {
			return [];
		}
	} catch (e) {
		return [];
	}

	const versionDirs = await readdir(modulePath);
	const modules = await Promise.all(versionDirs.map(ver => {
		return detectModule(modulePath, ver, ignoreDirs, logger);
	}));
	return modules.filter(Boolean);
}

/**
 * @param {string} modulePath parent directory (path to module dir holding name of module)
 * @param {string} ver basename of current dir holding the module (name is version number of module)
 * @param {RegExp} ignoreDirs regexp used to filter directories traversed
 * @param {object} [logger] optional logger object
 * @returns {Promise<null|object>}
 * @private
 */
async function detectModule(modulePath, ver, ignoreDirs, logger) {
	if (ignoreDirs.test(ver)) {
		return null;
	}

	const versionPath = join(modulePath, ver);
	const manifestFile = join(versionPath, 'manifest');
	if (!existsSync(manifestFile)) {
		return null;
	}

	const mod = {
		version: ver,
		modulePath: versionPath,
		manifest: await readManifest(manifestFile)
	};

	if (mod.manifest.version !== undefined) {
		mod.version = mod.manifest.version;
	}

	let platform = basename(dirname(dirname(versionPath))).toLowerCase();
	if (mod.manifest.platform) {
		platform = mod.manifest.platform.trim().toLowerCase();
		platform = platformAliases[platform] || platform;
		mod.manifest.platform = platform;
		mod.platform = [platform];
	}

	if (!mod.platform) {
		return null;
	}

	if (!version.isValid(mod.version)) {
		return null;
	}

	logger?.trace(`Detected ${cyan(mod.platform[0])} module: ${cyan(mod.manifest.moduleid)} @ ${mod.modulePath}`);
	return mod;
}

/**
 * Handles converting apiversion to an int, architectures to a string[]
 * @param {string} manifestFile path to manifest file
 * @returns {object}
 */
async function readManifest(manifestFile) {
	const manifest = {};
	const manifestContents = await readFile(manifestFile, 'utf8');
	for (const line of manifestContents.split('\n')) {
		const p = line.indexOf(':');
		if (line.charAt(0) !== '#' && p !== -1) {
			const key = line.substring(0, p);
			let value = line.substring(p + 1).trim();
			if (key === 'apiversion') {
				value = parseInt(value);
			} else if (key === 'architectures') {
				value = value.split(' ');
			}
			manifest[key] = value;
		}
	}
	return manifest;
}

/**
 * @param {object[]} modules array of all the distinct modules found
 * @returns {object} the modules re-aligned into a tree structure: platform -> name -> version -> module object
 */
function convertArrayOfModulesToHierarchy(modules) {
	const result = {};
	if (Array.isArray(modules)) {
		for (const m of modules) {
			const platform = m.platform[0];
			const name = m.manifest.moduleid;
			const version = m.version;
			result[platform] = (result[platform] || {});
			result[platform][name] = (result[platform][name] || {});
			result[platform][name][version] = m;
		}
	}
	return result;
}
