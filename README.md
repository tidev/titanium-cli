# Titanium CLI

Titanium CLI is a command line tool for creating and building apps using the Titanium SDK. It's
open-source and easy to use.

## Requirements

You must have Node.js 8.10.0 or newer.

You also must have the Appc Daemon ([appcd][2]) installed. You can install it via the [Axway
AMPLIFY Package Manager][3] or npm.

	amplify pm i appcd

or

	npm i -g appcd

## Installation

	npm i -g titanium@next

## Usage

	ti <command> [options]

or

	titanium <command> [options]

## Documenation

The official documentation is not available yet. In the meantime, view the help:

	ti -h

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/titanium/blob/master/LICENSE
[2]: https://www.npmjs.com/package/appcd
[3]: https://www.npmjs.com/package/@axway/amplify-cli