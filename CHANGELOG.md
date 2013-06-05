3.1.1
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
