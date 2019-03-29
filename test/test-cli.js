import path from 'path';
import { spawnSync } from 'child_process';

describe('Titanium CLI', () => {
	it('should fail if appcd is not found', async () => {
		const result = spawnSync(
			process.execPath,
			[ path.resolve(__dirname, '..', 'src', 'main.js') ],
			{ env: {} }
		);

		expect(result.status).to.equal(1);
		expect(result.stderr.toString()).to.have.string(
			'Error: Unable to find the Appc Daemon (appcd).\n'
			+ 'Run "npm i -g appcd" to install it.'
		);
	});
});
