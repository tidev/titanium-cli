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
export default async () => {
	const bridge = new Bridge();
	const schema = await bridge.schema();

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
};
