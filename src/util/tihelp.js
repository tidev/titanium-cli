import { Command, Help } from 'commander';
import { applyCommandConfig } from './apply-command-config.js';
import chalk from 'chalk';
import { capitalize } from './capitalize.js';

const { cyan, gray } = chalk;

export class TiHelp extends Help {
	constructor(cli, platforms) {
		super();

		this.platformCmds = {};
		this.typeCmds = {};

		if (cli && platforms) {
			for (const [name, conf] of Object.entries(platforms)) {
				const cmd = new Command(name);
				cmd.helpOption(false);
				applyCommandConfig(cli, name, cmd, conf);
				this.platformCmds[conf.title] = cmd;
			}
		}

		if (typeof cli?.command?.conf?.type === 'object') {
			for (const [type, conf] of Object.entries(cli.command.conf.type)) {
				const cmd = new Command(type);
				cmd.helpOption(false);
				applyCommandConfig(cli, type, cmd, conf);
				const title = `${cli.command.conf.title || cli.command.module?.title || ''} --type=${type}`.trim();
				this.typeCmds[title] = cmd;
			}
		}
	}

	padWidth(cmd, helper) {
		return Math.max(
			helper.longestOptionTermLength(cmd, helper),
			...Object.values(this.platformCmds).map(cmd => helper.longestOptionTermLength(cmd, helper)),
			helper.longestGlobalOptionTermLength(cmd, helper),
			helper.longestSubcommandTermLength(cmd, helper),
			helper.longestArgumentTermLength(cmd, helper)
		);
	}

	argumentDescription(argument) {
		const extraInfo = [];
		if (argument.argChoices) {
			extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`);
		}
		if (argument.defaultValue !== undefined) {
			extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
		}
		if (extraInfo.length > 0) {
			const extraDescripton = gray(`(${extraInfo.join(', ')})`);
			if (argument.description) {
				return `${argument.description} ${extraDescripton}`;
			}
			return extraDescripton;
		}
		return argument.description;
	}

	optionDescription(option) {
		const extraInfo = [];

		if (option.argChoices) {
			extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(', ')}`);
		}
		if (option.defaultValue !== undefined) {
			const showDefault = option.required || option.optional ||
				(option.isBoolean() && typeof option.defaultValue === 'boolean');
			if (showDefault) {
				extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
			}
		}
		if (option.presetArg !== undefined && option.optional) {
			extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
		}
		if (option.envVar !== undefined) {
			extraInfo.push(`env: ${option.envVar}`);
		}
		if (extraInfo.length > 0) {
			return `${option.description} ${gray(`(${extraInfo.join(', ')})`)}`;
		}

		return option.description;
	}

	formatHelp(cmd, helper) {
		const termWidth = helper.padWidth(cmd, helper);
		const helpWidth = helper.helpWidth || 80;
		const itemIndentWidth = 2;
		const itemSeparatorWidth = 2; // between term and description

		function formatItem(term, description) {
			if (description) {
				const fullText = `${cyan(term.padEnd(termWidth + itemSeparatorWidth))}${description}`;
				return helper.wrap(fullText, helpWidth - itemIndentWidth, termWidth + itemSeparatorWidth);
			}
			return cyan(term);
		}

		function formatList(textArray) {
			return textArray.join('\n').replace(/^/gm, ' '.repeat(itemIndentWidth));
		}

		// Usage
		let output = [`Usage: ${cyan(helper.commandUsage(cmd))}`, ''];

		// Description
		const commandDescription = helper.commandDescription(cmd);
		if (commandDescription.length > 0) {
			output = output.concat([helper.wrap(commandDescription, helpWidth, 0), '']);
		}

		// Commands
		const commandList = helper.visibleCommands(cmd).map((cmd) => {
			return formatItem(helper.subcommandTerm(cmd), helper.subcommandDescription(cmd));
		});
		if (commandList.length > 0) {
			output = output.concat(['Commands:', formatList(commandList), '']);
		}

		// Arguments
		const argumentList = helper.visibleArguments(cmd).map((argument) => {
			return formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument));
		});
		if (argumentList.length > 0) {
			output = output.concat([`${cmd.title || capitalize(cmd.name())} Arguments:`, formatList(argumentList), '']);
		}

		// Options
		const optionList = helper.visibleOptions(cmd).map((option) => {
			return formatItem(helper.optionTerm(option), helper.optionDescription(option));
		});
		if (optionList.length > 0) {
			output = output.concat([`${cmd.title || capitalize(cmd.name())} Options:`, formatList(optionList), '']);
		}

		for (const [title, platformCmd] of Object.entries(this.platformCmds)) {
			const argumentList = helper.visibleArguments(platformCmd).map((argument) => {
				return formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument));
			});
			if (argumentList.length > 0) {
				output = output.concat([`${title} Arguments:`, formatList(argumentList), '']);
			}

			const optionList = helper.visibleOptions(platformCmd).map((option) => {
				return formatItem(helper.optionTerm(option), helper.optionDescription(option));
			});
			if (optionList.length > 0) {
				output = output.concat([`${title} Options:`, formatList(optionList), '']);
			}
		}

		for (const [title, typeCmd] of Object.entries(this.typeCmds)) {
			const optionList = helper.visibleOptions(typeCmd).map((option) => {
				return formatItem(helper.optionTerm(option), helper.optionDescription(option));
			});
			if (optionList.length > 0) {
				output = output.concat([`${title} Options:`, formatList(optionList), '']);
			}
		}

		if (this.showGlobalOptions) {
			const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
				return formatItem(helper.optionTerm(option), helper.optionDescription(option));
			});
			if (globalOptionList.length > 0) {
				output = output.concat(['Global Options:', formatList(globalOptionList), '']);
			}
		}

		return output.join('\n');
	}
}
