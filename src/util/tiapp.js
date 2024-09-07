import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export class Tiapp {
	async select1(expr, defaultValue) {
		if (!this.doc) {
			throw new Error('No tiapp.xml loaded');
		}
		const { select1 } = await import('xpath');
		const nodes = select1(expr, this.doc);
		return nodes?.firstChild?.nodeValue ?? defaultValue;
	}

	async load(file) {
		if (!existsSync(file)) {
			throw new Error(`File not found: ${file}`);
		}

		let errorMsg;
		const { default: xmldom } = await import('@xmldom/xmldom');
		const parser = new xmldom.DOMParser({
			onError(type, err) {
				if (type === 'fatalError') {
					errorMsg = err;
				}
			}
		});
		const str = await readFile(file, 'utf8');
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
