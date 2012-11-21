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
