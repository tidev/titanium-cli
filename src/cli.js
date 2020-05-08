// istanbul ignore if
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Bridge from './bridge';

/**
 * Connects to the daemon and retrieves the CLI schema. This API is only called as an extension by
 * another program using cli-kit (e.g. the AMPLIFY CLI).
 *
 * @param {Extension} ext - A reference to the extension that loaded this package.
 * @returns {Promise<CLI>}
 */
export default async ext => {
	const bridge = new Bridge();
	const schema = await bridge.schema();

	bridge.disconnect();

	if (!schema) {
		throw new Error('Failed to get Titanium CLI schema');
	}

	// tell AMPLIFY CLI to not render the banner since the Titanium appcd plugin will render the
	// Titanium CLI banner instead
	schema.banner = false;

	// disable the calling cli-kit instance's built-in help command which will forward the `--help`
	// flag to the remote server where the help will be rendered
	schema.remoteHelp = true;

	// since the remote server has no idea the command hierarchy of the local instance, we have to
	// pass it an array of context names so that the help screen usage is correct
	const parentContextNames = [];
	for (let parent = ext.parent; parent; parent = parent.parent) {
		parentContextNames.unshift(parent.name);
	}

	// forward all actions to the remote server
	const action = ({ _argv, console }) => {
		return bridge.exec({
			argv: _argv.slice(1),
			console,
			parentContextNames
		});
	};

	// the action for this extension
	schema.action = action;

	// set the actions for each command since they were defined by the remote server and didn't
	// include actions
	for (const cmd of Object.values(schema.commands)) {
		cmd.action = action;
	}

	return schema;
};
