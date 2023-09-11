# Titanium CLI

> [Titanium CLI](https://github.com/tidev/titanium) is a Command Line Tool for creating and building Titanium Mobile applications and modules. It's open-source and easy to use. [We've](https://github.com/tidev) designed Titanium to be suitable for command line beginners, but still be powerful and extensible enough for production usage.

## Prerequisites

The Titanium CLI requires [Node.js 18](http://nodejs.org/dist/) or newer.

## Installation

    [sudo] npm install -g titanium

After install, Titanium CLI is executable as `ti` or `titanium`.

## Obtaining a Titanium SDK

You will need to download a Titanium SDK:

    # stable release (recommended)
    titanium sdk install

## Setting up the Titanium CLI

Before you begin using the Titanium CLI, you should configure it by running the "setup" command:

    titanium setup

## Usage

    titanium <command> [options]

## Built-in Commands

### config

Configure your CLI settings.

    # list all config settings
    titanium config

    # get a config setting
    titanium config <key>

    # set a config setting
    titanium config <key> <value>

### help

Displays help or help for a specific command.

    ti

    titanium --help

    titanium <command> --help

### sdk

Download and install Titanium SDKs

#### sdk install

Installs a specific version of the Titanium SDK. If no version is specified, it assumes the latest.

    titanium sdk install

    titanium sdk install <version>

    titanium sdk install <version> --force

#### sdk uninstall

Uninstalls a Titanium SDK.

    titanium sdk uninstall <version>

#### sdk list

Lists all installed Titanium SDKs. Optionally lists all branches and releases.

    titanium sdk list

    titanium sdk list -r
    titanium sdk list --releases

### setup

Reconfigures the Titanium CLI by asking you a series of questions.

    titanium setup

### version

Displays the current version of the CLI and exits.

    titanium -v

    titanium --version

### info

Displays information about your development environment including Xcode installs, iOS SDKs, Android SDKs, and so on.

    titanium info

    titanium info --json

## Hacking the Titanium CLI

In order to begin hacking on the Titanium CLI, you need to download and install [git](http://git-scm.com/).

If you have already installed a previous version of the Titanium CLI, it's recommended you uninstall the old one first:

    [sudo] npm uninstall -g titanium

The Titanium CLI is essentially pure JavaScript, so there is no build process.
You just need to pull the code and resolve the dependendencies.

    git clone git@github.com:tidev/titanium-cli.git
    cd titanium-cli
    npm install
    sudo npm link

### Running Unit Tests

To run the unit tests, simply run:

    npm test

## Contributing

Interested in contributing? There are several ways you can help contribute to this project.

### New Features, Improvements, Bug Fixes, & Documentation

Source code contributions are always welcome! Before we can accept your pull request, you must sign a Contributor License Agreement (CLA). Please visit https://tidev.io/contribute for more information.

### Donations

Please consider supporting this project by making a charitable [donation](https://tidev.io/donate). The money you donate goes to compensate the skilled engineeers and maintainers that keep this project going.

### Code of Conduct

TiDev wants to provide a safe and welcoming community for everyone to participate. Please see our [Code of Conduct](https://tidev.io/code-of-conduct) that applies to all contributors.

## Security

If you find a security related issue, please send an email to [security@tidev.io](mailto:security@tidev.io) instead of publicly creating a ticket.

## Stay Connected

For the latest information, please find us on Twitter: [Titanium SDK](https://twitter.com/titaniumsdk) and [TiDev](https://twitter.com/tidevio).

Join our growing Slack community by visiting https://slack.tidev.io!

## Legal

Titanium is a registered trademark of TiDev Inc. All Titanium trademark and patent rights were transferred and assigned to TiDev Inc. on 4/7/2022. Please see the LEGAL information about using our trademarks, privacy policy, terms of usage and other legal information at https://tidev.io/legal.
