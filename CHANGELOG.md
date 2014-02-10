3.2.1 (2/10/2014)
-------------------
 * Fixed bug where npm version was not being displayed due to race condition [TIMOB-15962]
 * Fixed bug where if the node executable is not called "node", the CLI would error because argv[0] != process.execPath. [TIMOB-15804]
 * Fixed bug when running "ti help" for a command that doesn't have 'platforms' [TIMOB-16233]
 * Fixed bug where CLI commands that require a minimum version of the Titanium CLI were not being checked properly. [TIMOB-16361]
 * Fixed command and hook loading when comparing the minimum required CLI version in which the version has a -beta suffix. [TIMOB-16365]

3.2.0 (12/20/2013)
-------------------
 * Completely overhauled entire CLI architecture
 * Brand new setup command with 'check environment' and 'quick setup' sections
 * Added better error handling with logging in and out of the Appc network; saving cli config [TIMOB-13908]
 * Added ID for each installed Android SDK and add-on to info command output [TIMOB-13797]
 * Fixed bug with CLI argument parser not properly removing the node process from the arguments [TIMOB-14074]
 * Added CLI hook to fix deploy type bug in Titanium SDK 3.0.0-3.1.X where deploy type not correctly set for iOS dist builds [TIMOB-14961]
 * Updated all afs.exists() calls to fs.existsSync() calls since we no longer support Node.js 0.6
 * Fixed bug when running quick setup when no SDKs installed [TIMOB-14965]
 * Adjusted placement of post-valdiate event hook
 * Fixed bug with option callbacks not being called for prompted options
 * Updated info command to use latest platform-specific detect() signature
 * Fixed minor bug with multiple options with same name not being converted to an array
 * Fixed all places where broken symlinks would cause errors
 * Fixed bug with detecting if CLI is being invoked by node.exe instead of titanium.cmd on Windows [TIMOB-14933]
 * Removed node-appc version check
 * Improved invalid and missing option handling
 * Refactored info command to call platform specific environment detection and info rendering
 * When a Titanium SDK 3.2 or newer is selected, info command displays much more info such as cert validity, installation issues, etc
 * Fixed bug in logger where errors were not honoring the --no-colors flag
 * Fixed escaping of default global ignoreDirs/ignoreFiles
 * Added ability to hide flag default values
 * Added --no-progress-bars flag to control display of progress bars and busy indicators which are enabled by default
 * Fixed a few places where --no-prompt was not being honored
 * Fixed sdk install command would fail when --no-prompt is set [TIMOB-15431]
 * Fixed bug when installing a Titanium SDK and the temp directory does not exist
 * Fixed bug when selected SDK is pre-3.0 or does not exist [TIMOB-15507]
 * Added CLI tools information to info and setup check commands on Mac OS X
 * Fixed command line argument parser to accept empty option values [TIMOB-15608]
 * Added ampersand checks to the setup command's Android SDK path prompt on Windows
 * Fixed bug where --quiet, --no-prompt, and --no-progress-bars when setting a value on via ti config or running ti setup would save those flags to the cli config
 * Added alias --no-color for --no-colors because I can never remember which one it is
 * Updated third party Node.js module dependency version where safe to do so
 * Updated the 'setup check' command to work offline and display connection diagnostics
 * Fixed bug when --username and --password are supplied at the command line
 * Fixed bug with the paths.sdks config setting continuously appending the default Titanium SDK install location [TIMOB-15813]
 * Fixed bug with 'npm outdated' returning a version of 'missing' [TIMOB-15842]
 * Removed Java 1.7 warning from the 'setup check' command
 * Fixed bug where options that have valid values but don't have a validate function never have their callbacks fired [TIMOB-15935]

3.1.2 (8/15/2013)
-------------------
 * Updated "request" module to 2.25.0 [TIMOB-11267]

3.1.1 (6/17/2013)
-------------------
 * Added support for code processor plugin paths [TIMOB-13118]

3.1.0 (4/16/2013)
-------------------
 * Fixed scoping in hooks system. Added better error handling for bad hooks [TIMOB-13040]
 * Fixed bug with "titanium config cli.logLevel" outputting as a log message [TIMOB-13194]
 * Changed default log level to "trace" [TIMOB-13194]
 * Fixed bug where hooks could reverse --no-colors flag [TIMOB-13374]

3.0.24 (2/19/2013)
-------------------
 * Enabled padding for non-log() messages such as info, debug, etc [TIMOB-12436]
 * Fixed config saving to automatically create the ~/.titanium directory if it doesn't exist. [TIMOB-12437]

3.0.23 (1/21/2013)
-------------------
 * Fixed bug with setup command where an error occurs when a previously saved active SDK version is invalid [TIMOB-12268]
 * Updated info command to output iOS certs by keychain based on a fix in node-appc [TIMOB-12033]
 * Added terminal character encoding detection [TIMOB-12347]
 * Fixed bug with detecting if setup needs to be run

3.0.22 (12/21/2012)
-------------------
 * Added the sdk select 'command' to the sdk's help screen [TIMOB-12113]
 * Tiny i18n string update

3.0.21 (12/10/2012)
-------------------
 * In the advanced setup wizard, fixed iOS developer cert name validation to allow names with and without an ID [TIMOB-12003]

3.0.20 (12/6/2012)
-------------------
 * Updated i18n strings [TIMOB-11825]

3.0.19 (11/30/2012)
-------------------
 * Fixed bug with --sdk not properly overriding the SDK from the config file [TIMOB-11883]

3.0.18 (11/21/2012)
-------------------
 * Added support for searching for modules using both the module search path from the config file as well as the root of the selected Titanium SDK [TIMOB-11776]

3.0.17 (11/20/2012)
-------------------
 * Added better support for config values that are lists. Now you can set entire lists, append items to lists, and remove items from lists [TIMOB-11753]
 * Updated I18N strings

3.0.16 (11/8/2012)
-------------------
 * Reduced "sdk" command's download progress bar width to reduce possibility of rendering artifacts [TIMOB-11470]

3.0.15 (11/7/2012)
-------------------
 * Fixed bug with duplicate abbreviation aliases were conflicting

3.0.14 (11/7/2012)
-------------------
 * Changed behavior to only list commands for the active Titanium SDK
 * Added "select" subcommand to "sdk" command for selecting the active Titanium SDK
 * Added better error message for invalid "sdk" command subcommands
 * Fixed bugs with the "sdk" command download progress bar on Windows
 * Added active Titanium SDK version to the banner
 * Updated CLI to use new environ detect() method and pass in SDK paths from the config file

3.0.13 (10/30/2012)
-------------------
 * Fixed bug when CLI config doesn't have any Titanium SDK home directories defined

3.0.12 (10/29/2012)
-------------------
 * Added support for specifying additional Titanium SDK home directory paths in the CLI config

3.0.11 (10/24/2012)
-------------------
 * Added "ti" alias
