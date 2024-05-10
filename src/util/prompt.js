/**
 * Lazy loads the `prompts` module.
 * @param  {Object} opts - Options to pass into `prompt()`
 * @returns {Promise}
 */
export async function prompt(opts) {
	const { default: prompts } = await import('prompts');
	const { prompt } = prompts;

	if (Array.isArray(opts)) {
		return await prompt(opts);
	}

	const { value } = await prompt({
		...opts,
		name: 'value'
	});
	if (value === undefined) {
		// sigint
		process.exit(0);
	}
	return value;
}
