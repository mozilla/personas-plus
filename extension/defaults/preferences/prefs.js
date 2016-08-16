// The type of persona the user selected.  Valid values:
//
//   default:
//     the default Firefox theme (i.e. no persona)
//   random:
//     a persona randomly selected from extensions.personas.category
//   randomFavorite:
//      a persona randomly selected from the user's favorites
//   current:
//     a persona selected by the user
//
// When this preference is set to "random", "randomFavorite", or "current",
// the current persona is stored in extensions.personas.current.
//
pref("extensions.personas.selected", "current");

// The initial persona that should get set on first run for a BYOB/bundle/
// distribution build.
//
// We don't specify this preference by default, as it should only be specified
// by a distribution.ini file. If you want to change the initial persona
// that gets set for other builds, change the hardcoded value in service.js.
//
// pref("extensions.personas.initial", ...);

// The current persona that is displayed in Firefox browser windows.
// Generally, this is the persona that the user selected from a menu
// in the extension or from the web gallery of personas.  But if the user
// selected "random persona from [category]", then this is the persona
// we randomly selected from the category; if the user selected "random
// from my favorites", this is the persona we randomly selected from
// the user's favorites; and if the user selected a custom persona,
// then this is that persona.
//
// We don't set this preference by default, as it gets set on first run
// by the service and subsequently by the user.
//
// pref("extensions.personas.current", ...);

// The category from which we pick a random persona, when the user selects
// "random persona from [category]".
pref("extensions.personas.category", "");

pref("extensions.personas.lastversion", "firstrun");

pref("extensions.personas.addons-host", "addons.mozilla.org");
pref("extensions.personas.services-host", "services.addons.mozilla.org");

pref("extensions.personas.addon-details.url", "https://%SERVICES_HOST%/en-US/api/1.5/addon/%ADDON_SLUG%/?format=json&src=%SRC%");

pref("extensions.personas.browse.url", "https://%ADDONS_HOST%/themes/?sort=%SORT%&src=%SRC%");

pref("extensions.personas.featured-feed.url", "https://%ADDONS_HOST%/collections/mozilla/featured-personas/format:json?src=%SRC%");

pref("extensions.personas.favorites-feed.url", "https://%ADDONS_HOST%/collections/mine/favorites/format:json?src=%SRC%");
pref("extensions.personas.favorites-browse.url", "https://%ADDONS_HOST%/collections/mine/favorites/?src=%SRC%");

pref("extensions.personas.initial.slug", "groovy-blue");

// The authorizedHosts preference is a comma and/or space-separated list
// of domains allowed to set and preview personas.
// At a minimum, it must contain a value matching the domain at which the web
// directory is located in order for the directory to work.
pref("extensions.personas.authorizedHosts", "getpersonas.com, www.getpersonas.com, personas.services.mozilla.com, www.mozilla.com, addons.mozilla.org");

pref("extensions.personas.lastselected0", "");
pref("extensions.personas.lastselected1", "");
pref("extensions.personas.lastselected2", "");
pref("extensions.personas.lastcategoryupdate", "");
pref("extensions.personas.lastlistupdate", "");

// The interval between consecutive persona reloads.  Measured in minutes,
// with a default of 24 hours and a minimum of one minute.
pref("extensions.personas.reloadInterval", 1440);

// The interval between consecutive persona snapshots.  Measured in seconds,
// with a default of 1 hour and a minimum of one second.
pref("extensions.personas.snapshotInterval", 3600);

// How long to wait onmouseover/out before triggering a persona preview
// or reset, in milliseconds.  It's not particularly useful for users to be able
// to set this pref, but it's useful for developers and testers to experiment
// with it to figure out what is the best value for it.
pref("extensions.personas.previewTimeout", 200);

// User preference to enable/disable preview when hovering over popup items.
pref("extensions.personas.previewEnabled", true);

// The version of the JSON data feed that this extension expects.
pref("extensions.personas.data.version", 1);

// User preference to specify the rotation interval of personas (in seconds)
// while in "random" or "randomFavorite" mode.
pref("extensions.personas.rotationInterval", 3600); // in seconds == 1 hour

// The ID of the Mercurial revision from which a particular package is built.
// This can help us narrow down the cause of a problem reported by a user.
pref("extensions.personas.revisionID", "282496e84f1d");

// The distribution channel for a particular package.  We use this to determine
// whether or not to display the "updated" page when the user updates the addon.
// We do show the page when the user updates to a new release build; we don't
// show it when the user upgrades to a new development build (which would get
// old fast since they come out so often).
pref("extensions.personas.channel", "rel");

// Preference to switch per-window personas mode on
pref("extensions.personas.perwindow", false);

pref("PersonaService.logging.console", "None");
pref("PersonaService.logging.dump", "None");

// Whether or not the toolbar button has been installed once (Firefox 4 support)
pref("extensions.personas.toolbarButtonInstalled", false);

pref("extensions.personas.tbinsert",true);
pref("extensions.personas.tbplaced",false);
