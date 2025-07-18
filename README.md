# Titanium CLI

[Titanium CLI](https://github.com/tidev/titanium) is a Command Line Tool for
creating and building Titanium Mobile applications and modules. It's
open-source and easy to use. [We've](https://github.com/tidev) designed
Titanium to be suitable for command line beginners, but still be powerful
and extensible enough for production usage.

## Installing the Titanium CLI

    [sudo] npm install -g titanium

After install, Titanium CLI is executable as `ti` or `titanium`.

> [!NOTE]
> The Titanium CLI requires [Node.js 20.18.1](http://nodejs.org/dist/) or newer.

## Installing the Titanium SDK

You will need to download a Titanium SDK:

    # stable release (recommended)
    ti sdk install latest

## Setting up the Titanium CLI

Before you begin using the Titanium CLI, it's a good idea to run the setup:

    ti setup

Next, run the info command to ensure Titanium can find the development
dependencies such as the Android SDK or Xcode.

    ti info

## Getting Help

To show help or help for a specific command.

    ti

    titanium --help

    titanium <command> --help

Visit https://titaniumsdk.com for more info.


## Commands

- [`ti build`](#build) - build a project
- [`ti clean`](#clean) - removes previous build directories
- [`ti config`](#config) - get and set config options
- [`ti create`](#create) - creates a new project
- [`ti info`](#info) - display development environment information
- [`ti module`](#module) - displays installed Titanium modules
- [`ti project`](#project) - get and set tiapp.xml settings
- [`ti sdk`](#sdk) - manages installed Titanium SDKs
- [`ti setup`](#setup) - sets up the Titanium CLI

### build

Builds a project for Android or iOS. Note that you need a Mac to build for iOS.

    ti build -p android

    ti build -p android -T device

    ti build -p ios

    ti build -p ios -T device

### clean

Removes the artifacts from the last build.

    ti clean

### config

Configure your CLI settings.

    # list all config settings
    ti config

    # get a config setting
    ti config <key>

    # set a config setting
    ti config <key> <value>

### create

Create a new project. The CLI will prompt for project settings.

    ti create

### info

Displays information about your development environment including Xcode
installs, iOS SDKs, Android SDKs, etc. If there are any issues or missing
dependencies, the info command will list them at the end.

    ti info

    ti info --json

### module

Show all installed modules.

    ti module

### project

Shows various project info from the `tiapp.xml`.

    ti project

    ti project name

### sdk

Manage Titanium SDKs. There are three subcommands: `list`, `install`, and `uninstall`.

### sdk install

Installs a specific version of the Titanium SDK. If no version is specified, it
will download the latest stable release.

    ti sdk i

    ti sdk install

    ti sdk install <version>

### sdk uninstall

Uninstalls a Titanium SDK.

    ti sdk rm <version>

    ti sdk uninstall <version>

### sdk list

Lists all installed Titanium SDKs.

    ti sdk
    ti sdk list

You can display the available releases:

    ti sdk list --releases

### setup

Reconfigures the Titanium CLI by asking you a series of questions.

    ti setup

### version

Displays the current version of the CLI and exits.

    ti -v

    ti --version

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
