if (typeof Cc == "undefined")
    var Cc = Components.classes;
if (typeof Ci == "undefined")
    var Ci = Components.interfaces;
if (typeof Cr == "undefined")
    var Cr = Components.results;
if (typeof Cu == "undefined")
    var Cu = Components.utils;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var PersonaController = {}

var WindowListener = {
    setupBrowserUI: function(window, closebar) {
        // Take any steps to add UI or anything to the browser window
        // document.getElementById() etc. will work here 
        PersonaController.startUp(window);
    },
    tearDownBrowserUI: function(window) {
        // Take any steps to remove UI or anything from the browser window
        // document.getElementById() etc. will work here
        PersonaController.shutDown(window);
    },
    // nsIWindowMediatorListener functions
    onOpenWindow: function(xulWindow) {
        // A new window has opened
        var domWindow = xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindow);
        // Wait for it to finish loading
        domWindow.addEventListener("load", function listener() {
            domWindow.removeEventListener("load", listener, false);
            // If this is a browser window then setup its UI
            var windowtype = domWindow.document.documentElement.getAttribute("windowtype");
            if (windowtype == "navigator:browser" || windowtype == "mail:3pane") WindowListener.setupBrowserUI(domWindow);
        }, false);
    },
    onCloseWindow: function(xulWindow) {},
    onWindowTitleChange: function(xulWindow, newTitle) {}
};

var PersonasPlusBootstrapAddon = {
    prefsinstance: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),
    STRINGS: [],
    startup: function(data, reason) {
        this.requestAddPrerequisites(data);
        this.setDefaultPrefs();
        this.setDefaultLocalizations();
        Cu.import("resource://personas/modules/personas.js");
        this.setupBrowserUI();
        this.addWindowListener();
        this.addAddonSkinCSS();
        if (reason == ADDON_ENABLE) {
            // modules that come with Firefox
            Cu.import("resource://gre/modules/XPCOMUtils.jsm");
            // LightweightThemeManager may not be not available (Firefox < 3.6 or Thunderbird)
            try {
                Cu.import("resource://gre/modules/LightweightThemeManager.jsm");
            } catch (e) {
                LightweightThemeManager = null;
            }
            try {
                var lastselected0 = PersonasPlusBootstrapAddon.prefsinstance.getCharPref("extensions.personas.lastselected0");
                LightweightThemeManager.currentTheme = JSON.parse(lastselected0);
            } catch (e) {}
        }
    },
    shutdown: function(data, reason) {
        // When the application is shutting down we normally don't have to clean
        // up any UI changes made
        if (reason == APP_SHUTDOWN) return;
        this.removeDefaultLocalizations();
        this.tearBrowserUI();
        this.removeWindowListener();
        this.removeAddonSkinCSS();
        Cu.unload("resource://personas/modules/personas.js");
        this.requestRemovePrerequisites(data);
        if (reason == ADDON_DISABLE) {
            // modules that come with Firefox
            Cu.import("resource://gre/modules/XPCOMUtils.jsm");
            // LightweightThemeManager may not be not available (Firefox < 3.6 or Thunderbird)
            try {
                Cu.import("resource://gre/modules/LightweightThemeManager.jsm");
            } catch (e) {
                LightweightThemeManager = null;
            }
            try {
                LightweightThemeManager.forgetUsedTheme(LightweightThemeManager.currentTheme.id);
            } catch (e) {
                try {
                    LightweightThemeManager.currentTheme = null;
                } catch (e) {}
            }
        }
    },
    requestAddPrerequisites: function(data) {
        this.addResourceProtocol(data);
        this.addChromeProtocol(data);
    },
    requestRemovePrerequisites: function(data) {
        this.removeResourceProtocol(data);
        this.removeChromeProtocol(data);
    },
    addResourceProtocol: function(data) {
        var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
        var rh = ios.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
        var nfu = ios.newFileURI(data.installPath);
        var isDir = data.installPath.isDirectory();
        if (isDir) {
            nfu = ios.newURI(nfu.spec + "/", null, null);
        } else {
            nfu = ios.newURI("jar:" + nfu.spec + "!/", null, null);
        }
        //Note for Validator: This is safe and used to register resource protocol for our add-on, i.e. resource://personas/
        rh.setSubstitution("personas", nfu);
    },
    removeResourceProtocol: function(data) {
        var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
        var r = ios.getProtocolHandler("resource").QueryInterface(Components.interfaces.nsIResProtocolHandler);
        r.setSubstitution("personas", null);
    },
    addChromeProtocol: function(data) {
        if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0 && Services.vc.compare(Services.appinfo.platformVersion, "8.0") >= 0)
            Components.manager.addBootstrappedManifestLocation(data.installPath);
    },
    removeChromeProtocol: function(data) {
        if (Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0 && Services.vc.compare(Services.appinfo.platformVersion, "8.0") >= 0)
            Components.manager.removeBootstrappedManifestLocation(data.installPath);
    },
    setDefaultPrefs: function() {
        function setDefaultPrefs(name, value) {
            function setPrefs(branch, name, value) {
                if (typeof value == "string") {
                    var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
                    str.data = value;
                    branch = branch ? branch : Services.prefs;
                    branch.setComplexValue(name, Components.interfaces.nsISupportsString, str);
                } else if (typeof value == "number") {
                    branch.setIntPref(name, value);
                } else if (typeof value == "boolean") {
                    branch.setBoolPref(name, value);
                }
            }
            var defaultBranch = Services.prefs.getDefaultBranch(null);
            setPrefs(defaultBranch, name, value);
        }
        Services.scriptloader.loadSubScript(this.getPrefsJS(), { pref: setDefaultPrefs });
    },
    getPrefsJS: function() {
        return "resource://personas/defaults/preferences/prefs.js";
    },
    setDefaultLocalizations: function() {
        Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).flushBundles();
        this.STRINGS["personas.properties"] = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://personas/locale/personas.properties");
        this.STRINGS["personas_bootstrap.properties"] = Components.classes["@mozilla.org/intl/stringbundle;1"]
            .getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://personas/locale/personas_bootstrap.properties");
    },
    removeDefaultLocalizations: function() {
        this.STRINGS = [];
        Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).flushBundles();
    },
    setupBrowserUI: function() {
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
        // Get the list of browser windows already open
        var windows = wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
            var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
            WindowListener.setupBrowserUI(domWindow, false);
        }
    },
    tearBrowserUI: function() {
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
        // Get the list of browser windows already open
        var windows = wm.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
            var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
            WindowListener.tearDownBrowserUI(domWindow);
        }
    },
    addWindowListener: function() {
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
        // Wait for any new browser windows to open
        wm.addListener(WindowListener);
    },
    removeWindowListener: function() {
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);
        // Stop listening for any new browser windows to open
        wm.removeListener(WindowListener);
    },
    registerStyle: function(url) {
        var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
            .getService(Components.interfaces.nsIStyleSheetService);
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);
        var uri = ios.newURI(url, null, null);
        if (!sss.sheetRegistered(uri, sss.AUTHOR_SHEET))
            sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);
    },
    unregisterStyle: function(url) {
        var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
            .getService(Components.interfaces.nsIStyleSheetService);
        var ios = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);
        var u = ios.newURI(url, null, null);
        if (sss.sheetRegistered(u, sss.AUTHOR_SHEET))
        //Note for Validator: This is safe and used to register our add-on skin, i.e. chrome://personas/skin/personas.css
            sss.unregisterSheet(u, sss.AUTHOR_SHEET);
    },
    addAddonSkinCSS: function() {
        this.registerStyle(this.getContentPersonasCSS());
        this.registerStyle(this.getSkinPersonasCSS());
        this.registerStyle(this.getSkinPersonasCSS());
    },
    removeAddonSkinCSS: function() {
        this.unregisterStyle(this.getContentPersonasCSS());
        this.unregisterStyle(this.getSkinPersonasCSS());
        this.unregisterStyle(this.getSkinPersonasCSS());
    },
    getContentPersonasCSS: function() {
        return "chrome://personas/content/personas.css";
    },
    getSkinPersonasCSS: function() {
        return "chrome://personas/skin/personas.css";
    },
    getContentOverlayCSS: function() {
        return "chrome://personas/content/overlay.css";
    }
}

function install(data) {}

function uninstall(data, reason) {
    if (reason != ADDON_UNINSTALL) return;
    Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService).getBranch("extensions.personas.").deleteBranch("");
    Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService).flushBundles();
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;
    const Cu = Components.utils;
    // modules that come with Firefox
    Cu.import("resource://gre/modules/XPCOMUtils.jsm");
    // LightweightThemeManager may not be not available (Firefox < 3.6 or Thunderbird)
    try {
        Cu.import("resource://gre/modules/LightweightThemeManager.jsm");
    } catch (e) {
        LightweightThemeManager = null;
    }
    try {
        LightweightThemeManager.forgetUsedTheme(LightweightThemeManager.currentTheme.id);
    } catch (e) {
        try {
            LightweightThemeManager.currentTheme = null;
        } catch (e) {}
    }
}

function startup(data, reason) {
    PersonasPlusBootstrapAddon.startup(data, reason);
}

function shutdown(data, reason) {
    PersonasPlusBootstrapAddon.shutdown(data, reason);
}
