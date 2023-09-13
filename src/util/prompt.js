/**
 * Lazy loads the `prompts` module.
 * @param  {...any} - Args to pass into `prompt()`
 * @returns {Promise}
 */
export async function prompt(...args) {
	const { default: prompts } = await import('prompts');
	const { prompt } = prompts;
	return prompt(...args);
}
