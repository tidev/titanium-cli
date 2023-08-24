import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

export class Tiapp {
	constructor() {
	}

	select1(expr, defaultValue) {
		if (!this.doc) {
			throw new Error('No tiapp.xml loaded');
		}
		const nodes = xpath.select1(expr, this.doc);
		return nodes?.firstChild?.nodeValue ?? defaultValue;
	}

	async load(file) {
		if (!existsSync(file)) {
			throw new Error(`File not found: ${file}`);
		}
		return this.loadFromString(await readFile(file, 'utf8'));
	}

	loadFromString(str = '<?xml version="1.0" encoding="UTF-8"?>') {
		if (str && typeof str !== 'string') {
			throw new TypeError('Expected string containing XML to parse');
		}

		let errorMsg;
		const parser = new DOMParser({
			errorHandler: err => errorMsg = err
		});
		const doc = parser.parseFromString(str, 'text/xml');
		if (errorMsg) {
			throw new Error(errorMsg);
		}

		let foundPIN = false;
		let child = doc.firstChild;
		for (; child; child = child.nextSibling) {
			if (child.nodeType === doc.PROCESSING_INSTRUCTION_NODE) {
				foundPIN = true;
				break;
			}
		}
		if (!foundPIN) {
			const pin = doc.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"');
			doc.insertBefore(doc.createTextNode('\n'), doc.firstChild);
			doc.insertBefore(pin, doc.firstChild);
		}

		this.doc = doc;
		return this;
	}
}
