## Overview

[Titanium](https://github.com/appcelerator/titanium) is a [Command Line Tool (CLI)](http://en.wikipedia.org/wiki/Command-line_interface)
for managing and deploying Titanium Mobile applications and modules. It's open-source and easy to use. [We've](https://github.com/appcelertor)
designed Titanium to be suitable for command line beginners, but still be powerful and extensible enough for production usage.

## Local Installation

    [sudo] npm install titanium -g

## Bleeding Edge

    // do this once
    git clone https://github.com/appcelerator/titanium.git
    
    // do this frequently
    cd /path/to/titanium
    git pull origin master
    [sudo] npm install -g .

## Commands

* config - Configure your CLI settings
* help - Displays help or help for a specific command
* login - Logs into the Appcelerator Network
* logout - Logs out of the Appcelerator Network
* sdk - Download and install Titanium SDKs
* status - Check authentication, SDK, and project status
* version - Titanium CLI version

## Usage

    titanium <command> [options]

## License

This project is open source and provided under the Apache Public License (version 2). Please make sure you see the `LICENSE` file
included in this distribution for more details on the license.  Also, please take notice of the privacy notice at the end of the file.

#### (C) Copyright 2012, [Appcelerator](http://www.appcelerator.com/) Inc. All Rights Reserved.
