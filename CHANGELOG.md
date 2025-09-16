8.0.1
-------------------
 * fix: On Windows call `powershell` instead of deprecated `wmic` command to
   get the OS name and version.

8.0.0 (8/1/2025)
-------------------
 * BREAKING CHANGE: Require Node.js 20.18.1 or newer
 * chore: Updated dependencies

7.1.7 (4/3/2025)
-------------------
 * fix: Fixed issue installing Hyperloop module where same name and version,
   but different platform.

7.1.6 (2/6/2025)
-------------------
 * fix: Fixed command path for Node 22.13.1.

7.1.5 (10/4/2024)
-------------------
 * fix: Improve tiapp sdk-version handling
 * chore: Update dependencies

7.1.4 (8/4/2024)
-------------------
 * fix: Load iOS hooks from `iphone` directory in the SDK

7.1.3 (8/1/2024)
-------------------
 * fix: Invalid `--platform` would cause crash because the platform
   validation was being bypassed

7.1.2 (7/31/2024)
-------------------
 * fix: Force `--platform` to `ios`; the SDK converts `ios` to `iphone`, but
   the CLI needs to reverse this to be able to look up the platform config

7.1.1 (7/30/2024)
-------------------
 * fix: Rename platform config `iphone` to `ios` to align with
   `ti.targetPlatforms`

7.1.0 (5/25/2024)
-------------------
 * feat: Support async hook `init()` functions
 * fix: Surface sdk install errors
 * fix: `ti sdk rm <ver>` treats confirm prompt as false
 * fix: Assert required Node.js version
 * fix: Clear out undefined command args which fixes `ti project`
 * fix: `ti sdk install` no longer silently fails when installing new modules
 * fix: When reinstalling an SDK, choosing "Overwrite" will force modules to
   also be reinstalled
 * fix: Properly handle result from `ti sdk install` overwrite prompt,
   `ti sdk uninstall` version prompt, and `ti setup user` name prompt

7.0.0 (5/10/2024)
-------------------
 * Require Node.js 18 or newer
 * Refactored entire codebase using ESM
 * Removed `login`, `logout`, `plugin`, and `status` commands
 * Removed all analytics/telemetry code
 * Removed i18n logic; all output rendered in English
 * Removed incomplete tab completion code
 * `--sdk <ver>` is now a global option
   - It assumes the latest installed SDK version...
   - If executing the `create` command without any options, it will prompt for
     the SDK version to use
 * Removed "default" SDK; `<sdk-version>` in tiapp.xml is source of truth,
   override with `--sdk <ver>` arg
 * Replaced custom CLI arg parser (based on `optimist`) with Commander.js
   - Order of arguments matter; command options must come after command
 * `-d`, `--project-dir` is now a global option
   - Used to be `build`, `clean`, and `project` commands only, but needed so
     the CLI can read the `tiapp.xml` and determine the `<sdk-version>`;
     defaults to the current working directory
   - Since this conflicts with the `create` command's `-d`, `--workspace-dir`
     option, special handling treats these two options the same
 * Added a new `--debug` global flag to output CLI debug logging
 * `ti config` changes:
   - Added `--json` flag
   - Replaced `--output json` with `--output json-object` output
 * `ti info` changes:
   - Added `--json` flag
   - Removed `haxm` info
   - Removed `genymotion` and VirtualBox info
   - Removed macOS info including Xcode CLI Tools
   - Removed `jarsigner` from JDK detection; no longer used thanks to Gradle
   - Removed `nodeAppcVer` from Titanium CLI and Titanium SDKs in info
 * `ti module` changes:
   - Removed global `iphone` modules as it was just a copy of `ios` modules
   - Modules with `platform` other than `android`, `commonjs`, `ios`, and
     `iphone` will be ignored
   - Modules with invalid semantic version will be ignored
 * `ti sdk` changes:
   - Added `--json` flag
   - Removed `activeSDK` from JSON result
   - `select` subcommand is a no-op
   - `install` subcommand `--default` flag is a no-op
 * `ti setup` changes:
   - Removed Windows Store publishing info
   - Removed `haxm` info
   - Removed `sdk` setup
   - Removed user locale setup
   - Removed Xcode CLI tools detection
   - Removed Titanium CLI Dependencies section from check
   - Removed Java-based connection test from check
 * Logger changes:
   - Replaced "winston" based logger with lighter weight logger
   - Trace and debug log messages written to `stderr` instead of `stdout`
   - Added total run time trace message at end
   - `--timestamp` option enabled only when command has `--log-level` option
 * Performance improvements:
   - Lazy load modules as much as possible, within reason
   - Removed tons of old dead code
   - Use smaller alternative dependencies
 * Updated dependencies, replaced deprecated dependencies
   - Replaced `colors` with `chalk`
   - Replaced `fields` with `prompts`
   - Replaced `humanize` with `pretty-bytes`
   - Replaced `request` with `undici`

6.1.1 (7/13/2022)
-------------------
 * Allow SDK directories to contain any version suffix

6.1.0 (6/28/2022)
-------------------
 * Re-enabled installing CI builds
 * Updated minor/patch dependencies

6.0.2 (5/24/2022)
-------------------
 * Disabled retrieving CI build branches and builds since it didn't work anyways

6.0.1 (5/23/2022)
-------------------
 * Updated banner copyright and links

6.0.0 (5/23/2022)
-------------------
 * BREAKING CHANGE: Dropped support for Node 12 and older
 * feat(sdk): handle an sdk zip downloaded as an artifact from github
 * feat(sdk): add timestamp flag
 * fix: optimize error for unknown deviceid

5.2.1 (2/15/2019)
-------------------
 * Fix selection of SDK when it is already installed [TIMOB-25179]
 * Update dependencies

5.2.0 (8/7/2018)
-------------------
 * Fix failure due to bad URL on `ti setup check` [TIMOB-26206]
 * Fix incorrect dependencies being reported when running `appc ti setup check` [TIMOB-24892]
 * Update dependencies

5.1.1 (6/5/2018)
-------------------
 * Added flag to disable analytics [TIMOB-26083]
 * Removed email from analytics payloads [TIMOB-26083]

5.1.0 (3/12/2018)
-------------------
 * Fix typo in Android NDK path prompt
 * Support detection of JDK 9 [TIMOB-25429]

5.0.14 (12/5/2017)
-------------------
 * Fix forking of correct SDK during `ti build` [TIMOB-24690]

5.0.13 (4/26/2017)
-------------------
 * Error thrown in CLI command plugin errors on load [TIMOB-24546]
 * Removed hook that fixed some Titanium SDK 3.x versions (which are no longer supported)
 * Avoid re-install of SDK from zipfile if already installed
 * Fix NDK validation, fix google.com network test #185

5.0.10 (9/22/2016)
-------------------
 * Fixed bug when running `ti setup sdk` and entering "latest" when the selected SDK no longer exists [TIMOB-23941]

5.0.4 (9/17/2015)
-------------------
 * Added actual SDK version to `ti sdk list` output as well as SDK details to `ti sdk list -o json` [TIMOB-19541]
 * Updated NPM dependencies

5.0.3 (9/9/2015)
-------------------
 * No longer display latest Node.js and NPM version as it confusing may imply the Titanium CLI supports them [TIMOB-19470]
 * Updated NPM dependencies

5.0.2 (9/9/2015)
-------------------
 * Fixed bug where 'ti setup check' was reporting the latest NPM version, not the latest stable version [TIMOB-19470]

5.0.1 (9/3/2015)
-------------------
 * Updated to node-appc 0.2.31 which fixes a bug with the JDK detection

5.0.0 (9/3/2015)
-------------------
 * Updated to node-appc 0.2.30

4.1.5 (8/18/2015)
-------------------
 * Fixed console colors when running in PowerShell [TIMOB-19126]

4.1.4 (8/4/2015)
-------------------
 * Fixed bug where the command line args weren't being parsed again after handling a branching option [TIMOB-19281]

4.0.1 (5/29/2015)
-------------------
 * Fixed bug with building an app that had a different Titanium SDK version than the selected SDK and abbreviated option names were being used [TIMOB-18826]

4.0.0 (5/20/2015)
-------------------
 * Added support for generic Titanium SDK-level info [TIMOB-17836]
 * Allow the colors to be controlled explicitly regardless if attached or detached from a TTY
 * Fixed bug where abbreviated options without values passed in before the last argument being treated as a boolean [TIMOB-18067]
 * Ripped out all authentication requirements. Analytics are now anonymous. Login and logout are no ops. [TIMOB-18711]
 * Capped SDK version monkey patch for which --password is converted to --store-password for Android [TIMOB-18783]

3.4.2 (3/6/2015)
-------------------
 * Fixed compatibility issues with Node 0.12 [TIMOB-18538]
 * Added Node.js version check when using a Titanium SDK [TIMOB-18629]
 * Drop support for Node.js 0.8 [TIMOB-18414]

3.4.1 (11/14/14)
-------------------
 * Fixed bug in Titanium SDK 3 bug fix hook where Xcode should only be removed when running on OS X [TIMOB-17808]

3.4.0 (9/29/14)
-------------------
 * Added support for selecting latest stable SDK [TIMOB-17378]
 * Fixed issues with config.json being overwritten at the same time [TIMOB-17346]
 * Improved handling of corrupt a config.json file [TIMOB-17346]
 * Fixed backwards compatibility with Titanium SDK 3.3.0 and older when building an iOS app and Xcode 6 or newer is installed
 * Added support for a "helpNoPrompt()" callback when a missing option is encountered
 * Fixed bug with abbreviated options that don't have a value being set to true
 * Fixed bug where Xcode 6 was not being removed from Titanium SDK 3.3.0 and older from the "ti info" results [TIMOB-17649]
 * Fixed bug where "ti info" failed when an invalid Titanium SDK is selected [TIMOB-17666]
 * Added support for paths.xcode in "ti config" [TIMOB-17696]

3.3.0 (7/17/14)
-------------------
 * Fixed bug with 'ti setup' when the selected Titanium SDK does not exist [TIMOB-12268]
 * Added Genymotion environment information to 'ti info' command [TIMOB-16349]
 * Fixed bug where OS and Node.js info was always being returned in 'ti info'
 * Added wp8 publisher guid to 'ti setup' [TIMOB-16748]
 * Added conflicting hook detection and improved hook error reporting [TIMOB-13847]
 * Added support for an array of hook events to emit; needed for [TIMOB-10752]
 * Updated Appcelerator API URLs to api.appcelerator.com [TIMOB-16282]
 * Added support for Titanium SDKs that can be named anything [TIMOB-16052]
 * Improved error handling when sdk command requests list of releases [TIMOB-16917]
 * Fixed bug with prompting for missing or invalid options that use generic prompting
 * Fixed sorting of Titanium SDKs in the 'sdk select' command to only list valid SDKs and order by their actual version number [TIMOB-16974]
 * Fixed bug where integer config values were being saved as strings instead of numbers [TIMOB-17000]
 * Fixed 'setup check' command when fetching available Node.js and NPM releases [TIMOB-16996]
 * Fixed bug with boolean config setting values being saved as integers [TIMOB-17087]
 * Moved the sending of analytics from the 'exit' event to the command finished callback [TIMOB-17046]
 * Fixed bug where the CLI would wait for analytics to send [TIMOB-17206]
 * Fixed formatting of multiline issues in 'ti info' [TIMOB-17221]
 * Fixed display of Android tools that are newer than the maximum supported version [TIMOB-17221]

3.2.3 (5/1/2014)
-------------------
 * When installing a Titanium SDK using the CI version name, but omitting the branch, it now automatically scans all branches [TIMOB-15899]
 * Fixed 'sdk' command to display custom Titanium SDK paths in SDK Install Locations [TIMOB-16141]
 * Fixed bug where the password was not being discarded after logging in and ends up confusing the Android build [TIMOB-16422]
 * Fixed list of options being displayed in help screen when colors are enabled on Windows [TIMOB-12759]
 * Added temp directory checking to the 'setup check' command [TIMOB-16671]
 * Fixed disabling of colors for 'setup' command. Also fixed --no-color flag [TIMOB-16853]

3.2.2
-------------------
 * Version skipped, no changes

3.2.1 (2/10/2014)
-------------------
 * Fixed bug where npm version was not being displayed due to race condition [TIMOB-15962]
 * Fixed bug where if the node executable is not called "node", the CLI would error because argv[0] != process.execPath [TIMOB-15804]
 * Fixed bug when running "ti help" for a command that doesn't have 'platforms' [TIMOB-16233]
 * Fixed bug where CLI commands that require a minimum version of the Titanium CLI were not being checked properly [TIMOB-16361]
 * Fixed command and hook loading when comparing the minimum required CLI version in which the version has a -beta suffix [TIMOB-16365]
 * Fixed bug when a SDK >=3.2.0 build is run with --password instead of --store-password [TIMOB-16354]

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

3.1.4 (12/18/2013)
-------------------
 * Fixed bug with detecting if CLI is being invoked by node.exe instead of titanium.cmd on Windows [TIMOB-14933]
 * Added support for config option cli.rejectUnauthorized to skip SSL cert validation [TIMOB-15783]

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
