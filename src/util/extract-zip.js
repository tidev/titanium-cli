import yauzl from 'yauzl';
import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Extracts a zip file to the specified destination.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.dest - The destination to extract the file.
 * @param {String} params.file - The path to the zip file to extract.
 * @param {Function} [params.onEntry] - A callback to fire per entry.
 * @returns {Promise}
 */
export async function extractZip(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}

	let { dest, file } = params;

	if (!dest || typeof dest !== 'string') {
		throw new TypeError('Expected destination directory to be a non-empty string');
	}

	if (!file || typeof file !== 'string') {
		throw new TypeError('Expected zip file to be a non-empty string');
	}

	if (!fs.existsSync(file)) {
		throw new Error('The specified zip file does not exist');
	}

	if (!fs.statSync(file).isFile()) {
		throw new Error('The specified zip file is not a file');
	}

	await new Promise((resolve, reject) => {
		yauzl.open(file, { lazyEntries: true }, (err, zipfile) => {
			if (err) {
				return reject(new Error(`Invalid zip file: ${err.message || err}`));
			}

			let idx = 0;
			const total = zipfile.entryCount;
			const abort = err => {
				zipfile.removeListener('end', resolve);
				zipfile.close();
				reject(err);
			};

			zipfile
				.on('entry', async entry => {
					idx++;
					if (typeof params.onEntry === 'function') {
						try {
							await params.onEntry(entry.fileName, idx, total);
						} catch (e) {
							return reject(e);
						}
					}

					const fullPath = path.join(dest, entry.fileName);
					const mode = (entry.externalFileAttributes >>> 16) || 0o644;

					const symlink = (mode & fs.constants.S_IFMT) === fs.constants.S_IFLNK;
					let isDir = (mode & fs.constants.S_IFMT) === fs.constants.S_IFDIR;

					// check for windows weird way of specifying a directory
					// https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
					const madeBy = entry.versionMadeBy >> 8;
					if (!isDir) {
						isDir = (madeBy === 0 && entry.externalFileAttributes === 16);
					}

					if (symlink) {
						await mkdir(path.dirname(fullPath), { recursive: true });
						zipfile.openReadStream(entry, (err, readStream) => {
							if (err) {
								return abort(err);
							}

							const chunks = [];
							readStream.on('data', chunk => chunks.push(chunk));
							readStream.on('error', abort);
							readStream.on('end', () => {
								let str = Buffer.concat(chunks).toString('utf8');
								if (fs.existsSync(fullPath)) {
									fs.unlinkSync(fullPath);
								}
								// fs.symlinkSync(str, fullPath);
								zipfile.readEntry();
							});
						});
					} else if (isDir) {
						await mkdir(fullPath, { recursive: true });
						zipfile.readEntry();
					} else {
						await mkdir(path.dirname(fullPath), { recursive: true });
						zipfile.openReadStream(entry, (err, readStream) => {
							if (err) {
								return abort(err);
							}

							const writeStream = fs.createWriteStream(fullPath,  {
								mode
							});
							writeStream.on('close', () => zipfile.readEntry());
							writeStream.on('error', abort);
							readStream.pipe(writeStream);
						});
					}
				})
				.once('end', resolve)
				.readEntry();
		});
	});
}
