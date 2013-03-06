/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Personas.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jose E. Bolanos <jose@appcoast.com>
 *   Myk Melez <myk@mozilla.org>
 *   Nils Maier <maierman@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// LightweightThemeManager may not be not available
// (Firefox < 3.6 and some versions of Thunderbird)
try { Cu.import("resource://gre/modules/LightweightThemeManager.jsm"); }
catch (e) { LightweightThemeManager = null; }

const PREF_EM_DSS_ENABLED             = "extensions.dss.enabled";
const PREF_DSS_SWITCHPENDING          = "extensions.dss.switchPending";
const PREF_DSS_SKIN_TO_SELECT         = "extensions.lastSelectedSkin";
const PREF_LWTHEME_TO_SELECT          = "extensions.lwThemeToSelect";
const PREF_GENERAL_SKINS_SELECTEDSKIN = "general.skins.selectedSkin";
const PREF_FORCE_SKINNING             = "lightweightThemes.forceSkinning";
const URI_EXTENSION_MANAGER           = "chrome://mozapps/content/extensions/extensions.xul";
const FEATURES_EXTENSION_MANAGER      = "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable";
const PREFIX_NS_EM                    = "http://www.mozilla.org/2004/em-rdf#";
const PREFIX_ITEM_URI                 = "urn:mozilla:item:";

const DEFAULT_THEME = "classic/1.0";

// If defineLazyServiceGetter is not present we won't load anyway, as this is
// 3.6+ only
if ('defineLazyServiceGetter' in XPCOMUtils) {
  XPCOMUtils.defineLazyServiceGetter(
    this, "gRDF",
    "@mozilla.org/rdf/rdf-service;1", "nsIRDFService"
    );
  XPCOMUtils.defineLazyServiceGetter(
    this, "gExtMan",
    "@mozilla.org/extensions/manager;1", "nsIExtensionManager"
    );
  XPCOMUtils.defineLazyServiceGetter(
    this, "gIoServ",
    "@mozilla.org/network/io-service;1", "nsIIOService"
    );
  XPCOMUtils.defineLazyServiceGetter(
    this, "gAppStartup",
    "@mozilla.org/toolkit/app-startup;1", "nsIAppStartup"
    );
}

//
// Utility Functions
//

function stringData(literalOrResource) {
  if (literalOrResource instanceof Ci.nsIRDFLiteral)
    return literalOrResource.Value;
  if (literalOrResource instanceof Ci.nsIRDFResource)
    return literalOrResource.Value;
  return undefined;
}

function intData(literal) {
  if (literal instanceof Ci.nsIRDFInt)
    return literal.Value;
  return undefined;
}

function getURLSpecFromFile(file) {
  return gIoServ.newFileURI(file).spec;
}

function restartApp() {
  // Notify all windows that an application quit has been requested.
  var cancelQuit =
    Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
  Observers.notify("quit-application-requested", cancelQuit, "restart");

  // Something aborted the quit process.
  if (cancelQuit.data)
    return;

  gAppStartup.quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
}

/**
 * Overriden Extension Manager object. Handles the lightweight theme observer
 * notifications to allow personas to be applied over compatible themes.
 */
function PersonasExtensionManager() {
  Cu.import("resource://personas/modules/Observers.js");
  Cu.import("resource://personas/modules/Preferences.js");

  // Add observers for the lightweight theme topics to override their behavior,
  // and for the xpcom-shutdown topic to remove them afterwards.
  Observers.add("xpcom-shutdown", this);
  Observers.add("lightweight-theme-preview-requested", this);
  Observers.add("lightweight-theme-change-requested", this);
}

PersonasExtensionManager.prototype = {
  classDescription: "Personas Plus Extension Manager Integrator",
  contractID: "@mozilla.org/extensions/personas-manager;1",
  classID: Components.ID("{21372722-3631-41c3-8946-950382a3c523}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  _xpcom_categories: [
    {category: "profile-after-change"},
    {category: "app-startup", service: true}
  ],

  /* Whether the current theme is compatible with Personas */
  _currentThemeSkinnable : true,

  /* Personas string bundle */
  _strings : null,
  get strings() {
    if (!this.StringBundle)
      Cu.import("resource://personas/modules/StringBundle.js", this);
    if (!this._strings)
      this._strings = new this.StringBundle("chrome://personas/locale/personas.properties");
    return this._strings;
  },

  /**
   * Overriden method from the original nsExtensionManager.
   * Handles different observer notifications, and delegates the rest to the
   * original nsExtensionManager object.
   */
  observe: function(subject, topic, data) {
    let forceSkinning;

    switch (topic) {
      case "app-startup":
        // Unregister the nsExtensionManager profile-after-change.
        // PersonasExtensionManager will register it's own and call
        // nsExtensionManager from there after running some own code.
        // We need to use app-startup here to be called before the
        // profile-after-change notification.
        try {
          let catMan = Cc["@mozilla.org/categorymanager;1"].
                       getService(Ci.nsICategoryManager);
          catMan.deleteCategoryEntry("profile-after-change", "Extension Manager", false);
        }
        catch (ex) {
          // Do nothing here.
        }
      break;

      case "lightweight-theme-preview-requested":
        forceSkinning = Preferences.get(PREF_FORCE_SKINNING, false);

        // Cancel if a custom theme with no support for personas is set.
        if (!this._currentThemeSkinnable && !forceSkinning) {
          let cancel = subject.QueryInterface(Ci.nsISupportsPRBool);
          cancel.data = true;
        }
        break;

      case "lightweight-theme-change-requested":
        let theme = JSON.parse(data);
        if (!theme)
          return;

        // Cancel this topic and prompt to restart only if the persona is being
        // set over a custom theme with no support for personas.
        forceSkinning = Preferences.get(PREF_FORCE_SKINNING, false);

        if (!this._currentThemeSkinnable && !forceSkinning) {
          if (Preferences.get(PREF_EM_DSS_ENABLED, false)) {
            Preferences.reset(PREF_GENERAL_SKINS_SELECTEDSKIN);
            return;
          }

          let cancel = subject.QueryInterface(Ci.nsISupportsPRBool);
          cancel.data = true;

          Preferences.set(PREF_DSS_SWITCHPENDING, true);
          Preferences.set(PREF_DSS_SKIN_TO_SELECT, DEFAULT_THEME);
          Preferences.set(PREF_LWTHEME_TO_SELECT, theme.id);

          // Show notification in the browser to restart.
          this._showRestartNotification();
          return;
        }
        else {
          // Cancel any pending theme change and allow the lightweight theme
          // change to go ahead
          if (Preferences.isSet(PREF_DSS_SWITCHPENDING))
            Preferences.reset(PREF_DSS_SWITCHPENDING);
          if (Preferences.isSet(PREF_DSS_SKIN_TO_SELECT))
            Preferences.reset(PREF_DSS_SKIN_TO_SELECT);
        }
        break;

      case "xpcom-shutdown":
        // Remove the observers
        Observers.remove("xpcom-shutdown", this);
        Observers.remove("lightweight-theme-preview-requested", this);
        Observers.remove("lightweight-theme-change-requested", this);
        break;

      case "profile-after-change":
        // Remove the original nsExtensionManager listeners for the
        // lightweight theme topics. This might fail when the given aIID has not
        // these topics registered, but can be safely ignored.
        try {
          // Cannot use Observers here
          let os = Cc["@mozilla.org/observer-service;1"].
                   getService(Ci.nsIObserverService);
          os.removeObserver(gExtMan, "lightweight-theme-preview-requested");
          os.removeObserver(gExtMan, "lightweight-theme-change-requested");
        }
        catch (ex) {
          // Do nothing here.
        }

        try {
          if (Preferences.get(PREF_DSS_SWITCHPENDING)) {
            var toSelect = Preferences.get(PREF_DSS_SKIN_TO_SELECT);
            Preferences.set(PREF_GENERAL_SKINS_SELECTEDSKIN, toSelect);
            Preferences.reset(PREF_DSS_SWITCHPENDING);
            Preferences.reset(PREF_DSS_SKIN_TO_SELECT);
          }

          if (Preferences.isSet(PREF_LWTHEME_TO_SELECT)) {
            var id = Preferences.get(PREF_LWTHEME_TO_SELECT);
            if (id) {
              try {
                let persona = LightweightThemeManager.getUsedTheme(id);
                let personas = {};
                Cu.import("resource://personas/modules/service.js", personas);
                personas.PersonaService.changeToPersona(persona);
              } catch (e) {}
            }
            else {
              LightweightThemeManager.currentTheme = null;
            }
            Preferences.reset(PREF_LWTHEME_TO_SELECT);
          }
        }
        catch (e) {
          // Do nothing here.
        }

        // Let the original nsExtensionManager perform actions
        // during "profile-after-change".
        gExtMan.observe(subject, topic, data);
        // Load current theme properties, e.g. "skinnable" property.
        this._loadThemeProperties();
        break;
    }
  },

  /**
   * Shows a notification in the browser informing to the user to restart it so
   * the persona can be applied.
   */
  _showRestartNotification : function() {
    // Obtain most recent window and its notification box
    let wm =
      Cc["@mozilla.org/appshell/window-mediator;1"].
        getService(Ci.nsIWindowMediator);

    let notificationBox =
      wm.getMostRecentWindow("navigator:browser").
        getBrowser().getNotificationBox();

    // If there is another notification of the same kind already, remove it.
    let oldNotification =
      notificationBox.getNotificationWithValue("lwtheme-restart-notification");
    if (oldNotification)
      notificationBox.removeNotification(oldNotification);

    let restartButton = {
      label     : this.strings.get("notification.restartButton.label"),
      accessKey : this.strings.get("notification.restartButton.accesskey"),
      popup     : null,
      callback  : restartApp
    };

    let notificationBar =
      notificationBox.appendNotification(
        this.strings.get("notification.restartToApply"),
        "lwtheme-restart-notification", null,
        notificationBox.PRIORITY_INFO_HIGH, [ restartButton ] );
    notificationBar.persistence = 1;
  },

  /**
   * Loads the current theme properties (i.e. whether it is skinnable).
   */
  _loadThemeProperties : function() {
    // The following code determines whether the current theme is skinnable.
    // This is true when the current theme is the default one, classic/1.0, or
    // when the theme has the "skinnable" property set to true in its install.rdf.
    let currentTheme = Preferences.get(PREF_GENERAL_SKINS_SELECTEDSKIN);

    if (currentTheme == DEFAULT_THEME)
      this._currentThemeSkinnable = true;
    else {
      // Find the current theme and load its install.rdf to read its
      // "skinnable" property.
      let themes = gExtMan.getItemList(Ci.nsIUpdateItem.TYPE_THEME, { });
      for (let i = 0; i < themes.length; i++) {
        let theme = themes[i];

        let internalName = this._getItemProperty(theme.id, "internalName");
        if (internalName == currentTheme) {
          this._loadThemeSkinnableProperty(theme.id);
          break;
        }
      }
    }
  },

  /**
   * Loads the "skinnable" property of an installed theme.
   * @param aThemeId The Id of the theme.
   */
  _loadThemeSkinnableProperty : function(aThemeId) {
    let t = this;
    let onInstallRDFLoaded = function(aDatasource) {
      let skinnable = t._getInstallRDFProperty(aDatasource, "skinnable");
      t._currentThemeSkinnable = (skinnable === "true");

      if (!t._currentThemeSkinnable) {
        if (!Preferences.get(PREF_FORCE_SKINNING, false)) {
          LightweightThemeManager.currentTheme = null;

          try {
            let personas = {};
            Cu.import("resource://personas/modules/service.js", personas);
            personas.PersonaService.changeToDefaultPersona();
          } catch (e) {}
        }
      }
    };

    let location = gExtMan.getInstallLocation(aThemeId);
    let file = location.getItemFile(aThemeId, "install.rdf");
    this._loadDatasource(file, onInstallRDFLoaded);
  },

  /**
   * Loads an RDF datasource file.
   * @param aDatasourceFile The file path of the datasource.
   * @param aLoadCallback Callback used to notify the caller when the datasource
   * has finished loading.
   */
  _loadDatasource : function(aDatasourceFile, aLoadCallback) {
    let ds = gRDF.GetDataSource(getURLSpecFromFile(aDatasourceFile));
    let remote = ds.QueryInterface(Ci.nsIRDFRemoteDataSource);

    if (remote.loaded)
      aLoadCallback(ds);
    else {
      let observer = {
        onBeginLoad: function(aSink) {},
        onInterrupt: function(aSink) {},
        onResume: function(aSink) {},
        onError: function(aSink, aStatus, aErrorMsg) {},
        onEndLoad: function(aSink) {
          aSink.removeXMLSinkObserver(this);
          aLoadCallback(ds);
        }
      };

      let sink = ds.QueryInterface(Ci.nsIRDFXMLSink);
      sink.addXMLSinkObserver(observer);
    }
  },

  /**
   * Gets a property of an item (theme) from extensions.rdf
   * @param aItemId The id of the item.
   * @param aPropertyName The name of the property to get.
   * @return The value of the property, or undefined if not found.
   */
  _getItemProperty : function(aItemId, aPropertyName) {
    return this._getDatasourceProperty(
      gExtMan.datasource,
      PREFIX_ITEM_URI + aItemId,
      PREFIX_NS_EM + aPropertyName);
  },

  /**
   * Gets a property of the given extension install.rdf datasource.
   * @param aDatasource The install.rdf datasource.
   * @param aPropertyName The name of the property to get.
   * @return The value of the property, or undefined if not found.
   */
  _getInstallRDFProperty : function(aDatasource, aPropertyName) {
    return this._getDatasourceProperty(
      aDatasource,
      "urn:mozilla:install-manifest",
      PREFIX_NS_EM + aPropertyName);
  },

  /**
   * Gets the value of a property from the given datasource.
   * @param aDatasource The datasource from which to get the property.
   * @param aResourceName The name of the resource which contains the property
   * within the datasource.
   * @param aPropertyName The name of the property to get.
   * @return The value of the property, or undefined if not found.
   */
  _getDatasourceProperty : function(aDatasource, aResourceName, aPropertyName) {
    let resource = gRDF.GetResource(aResourceName);
    let property = gRDF.GetResource(aPropertyName);

    if (!resource || !property)
      return undefined;

    let target = aDatasource.GetTarget(resource, property, true);
    let value = stringData(target);
    if (value === undefined)
      value = intData(target);
    return value === undefined ? "" : value;
  }
};

var components = [];

// Register this component only on Firefox 3.6.*
const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
var appInfo = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
var versionChecker =
  Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);

if (appInfo.ID == FIREFOX_ID &&
    versionChecker.compare(appInfo.version, "3.6") >= 0 &&
    versionChecker.compare(appInfo.version, "3.6.*") < 0) {
  components = [PersonasExtensionManager];
}

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
