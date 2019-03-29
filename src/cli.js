// istanbul ignore if
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Bridge from './bridge';

/**
 * Connects to the daemon and retrieves the CLI schema.
 *
 * @returns {Promise<CLI>}
 */
export default async function getCLI() {
	const bridge = new Bridge();
	const response = await bridge.request('/schema');
	const schema = await new Promise((resolve, reject) => {
		response
			.once('data', resolve)
			.once('close', resolve)
			.once('error', reject);
	});

	if (!schema) {
		throw new Error('Failed to get Titanium CLI schema');
	}

	const action = async ({ __argv, console }) => {
		bridge.exec({ argv: __argv.slice(1), console });
	};

	for (const cmd  of Object.values(schema.commands)) {
		cmd.action = action;
	}

	return schema;
}
