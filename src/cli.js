// istanbul ignore if
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Bridge from './bridge';

/**
 * Connects to the daemon and retrieves the CLI schema. This API is only called as an extension by
 * another program using cli-kit (e.g. the AMPLIFY CLI).
 *
 * @returns {Promise<CLI>}
 */
export default async function getCLI() {
	throw new Error('Temporarily unavailable');

	/*
	const bridge = new Bridge();
	const response = await bridge.request('/schema');
	const schema = await new Promise((resolve, reject) => {
		response
			.once('response', resolve)
			.once('finish', resolve)
			.once('close', resolve)
			.once('error', reject);
	});

	bridge.disconnect();

	if (!schema) {
		throw new Error('Failed to get Titanium CLI schema');
	}

	const action = ({ __argv, console }) => bridge.exec({
		argv: __argv.slice(1),
		console
	});

	schema.action = action;

	for (const cmd of Object.values(schema.commands)) {
		cmd.action = action;
	}

	return schema;
	*/
}
