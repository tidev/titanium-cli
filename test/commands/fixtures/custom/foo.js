export const title = 'foo';
export const desc = 'an example of a custom command';
export const extendedDesc = 'This is a custom command loaded via paths.commands';

export function config(logger, config, cli) {
	//
}

export function validate(logger, config, cli) {
	//
}

export function run(logger, config, cli) {
	logger.log('Foo!');
}
