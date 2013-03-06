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
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Chris Beard <cbeard@mozilla.org>
 *   Myk Melez <myk@mozilla.org>
 *   Chris <kidkog@gmail.com>
 *   Byron Jones (glob) <bugzilla@glob.com.au>
 *   Anant Narayanan <anant@kix.in>
 *   Jose E. Bolanos <jose@appcoast.com>
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

// Generic modules get imported into the persona controller rather than
// the global namespace after the controller definition below so they don't
// conflict with modules with the same names imported by other extensions.

// Define Components as var here as they are already defined for Firefox. See Bug 484062 for details.
  if (typeof Cc == "undefined")
    var Cc = Components.classes;
  if (typeof Ci == "undefined")
    var Ci = Components.interfaces;
  if (typeof Cr == "undefined")
    var Cr = Components.results;
  if (typeof Cu == "undefined")
    var Cu = Components.utils;

// It's OK to import the service module into the global namespace because its
// exported symbols all contain the word "persona" (f.e. PersonaService).
Cu.import("resource://personas/modules/service.js");

let PersonaController = {
  _previewTimeoutID: null,
  _resetTimeoutID: null,

  //**************************************************************************//
  // Shortcuts

  // Generic modules get imported into these properties rather than
  // the global namespace so they don't conflict with modules with the same
  // names imported by other extensions.
  Observers:               null,
  Preferences:             null,
  StringBundle:            null,
  URI:                     null,
  LightweightThemeManager: null,

  // Access to extensions.personas.* preferences.  To access other preferences,
  // call the Preferences module directly.
  get _prefs() {
    delete this._prefs;
    return this._prefs = new this.Preferences("extensions.personas.");
  },

  get _strings() {
    delete this._strings;
    return this._strings = new this.StringBundle("chrome://personas/locale/personas.properties");
  },

  get _brandStrings() {
    delete this._brandStrings;
    return this._brandStrings =
      new this.StringBundle("chrome://branding/locale/brand.properties");
  },

  get _menu() {
    delete this._menu;
    return this._menu = document.getElementById("personas-menu");
  },

  get _menuButton() {
    delete this._menuButton;
    return this._menuButton = document.getElementById("personas-selector-button");
  },

  get _menuPopup() {
    delete this._menuPopup;
    return this._menuPopup = document.getElementById("personas-selector-menu");
  },

  get _toolbarButton() {
    delete this._toolbarButton;
    return this._toolbarButton = document.getElementById("personas-toolbar-button");
  },

  get _sessionStore() {
    delete this._sessionStore;
    return this._sessionStore = Cc["@mozilla.org/browser/sessionstore;1"]
                                .getService(Ci.nsISessionStore);
  },

  get _header() {
    delete this._header;
    switch (PersonaService.appInfo.ID) {
      case PersonaService.THUNDERBIRD_ID:
        return this._header = document.getElementById("messengerWindow");
      case PersonaService.FIREFOX_ID:
        return this._header = document.getElementById("main-window");
      default:
        throw "unknown application ID " + PersonaService.appInfo.ID;
    }
  },

  get _footer() {
    delete this._footer;
    switch (PersonaService.appInfo.ID) {
      case PersonaService.THUNDERBIRD_ID:
        return this._footer = document.getElementById("status-bar");
      case PersonaService.FIREFOX_ID:
        return this._footer = document.getElementById("browser-bottombox");
      default:
        throw "unknown application ID " + PersonaService.appInfo.ID;
    }
  },

  get _thunderbirdRegExp() {
    delete this._thunderbirdRegExp;
    return this._thunderbirdRegExp = new RegExp("^" + this._siteURL);
  },

  get _siteURL() {
    return "https://" + this._prefs.get("host") + "/";
  },

  get _previewTimeout() {
    return this._prefs.get("previewTimeout");
  },

  // XXX We used to use this to direct users to locale-specific directories
  // on the personas server, but we're not using it anymore, as we no longer
  // have locale-specific pages on the server.  And once we get them back,
  // it'll probably make more sense for the browser and server to do locale
  // negotiation using the standard mechanisms anyway, so this is no longer
  // needed.
  get _locale() {
    switch (this.Preferences.get("general.useragent.locale", "en-US")) {
      case 'ja':
      case 'ja-JP-mac':
        return "ja";
    }
    return "en-US";
  },

  /**
   * Escape CSS special characters in unquoted URLs,
   * per http://www.w3.org/TR/CSS21/syndata.html#uri.
   */
  _escapeURLForCSS: function(url) url.replace(/[(),\s'"]/g, "\$&"),

  openURLInTab: function(url) {
    switch (PersonaService.appInfo.ID) {
      case PersonaService.THUNDERBIRD_ID:
        // Thunderbird's "openTab" implementation for the "contentTab" mode
        // automatically switches to an existing tab containing the URL we are
        // opening, so we don't have to check for one here.
        Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator).
        getMostRecentWindow("mail:3pane").
        document.getElementById("tabmail").
        openTab("contentTab", { contentPage: url,
                                clickHandler: "specialTabs.siteClickHandler(event, PersonaController._thunderbirdRegExp);" });
        break;

      case PersonaService.FIREFOX_ID:
      default: {
        // Firefox's "openUILinkIn" implementation doesn't check if there is
        // already an existing tab containing the URL we are opening, so we have
        // to check for one here.
        let found = false;
        let tabBrowser = window.getBrowser();
        // Check each tab of this browser for the editor XUL file
        let numTabs = tabBrowser.browsers.length;
        for (let index = 0; index < numTabs; index++) {
          let currentBrowser = tabBrowser.getBrowserAtIndex(index);
          if (url == currentBrowser.currentURI.spec) {
            tabBrowser.selectedTab = tabBrowser.mTabs[index];
            found = true;
            break;
          }
        }
        if (!found)
          window.openUILinkIn(url, "tab");
        break;
      }
    }
  },


  //**************************************************************************//
  // XPCOM Interface Implementations

  // nsISupports
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsIDOMEventListener) ||
        aIID.equals(Ci.nsISupports))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  // nsIObserver
  observe: function(subject, topic, data) {
    switch (topic) {
      case "domwindowopened":
        // Since there's no explicit notification for windows restored from
        // session store, we use this to apply the per-window persona
        // (but only if one exists).
        //
        // Bug 534669 has been filed for adding SSWindowRestored support.
        if (this._prefs.get("perwindow") &&
            (window.document.documentElement.getAttribute("windowtype")
              == "navigator:browser") &&
            this._sessionStore.getWindowValue(window, "persona")) {
          this._applyPersona(JSON.parse(
            this._sessionStore.getWindowValue(window, "persona")
          ));
        }
        break;
      case "personas:persona:changed":
        // Per-window personas are enabled
        if (this._prefs.get("perwindow")) {
          if (this._sessionStore.getWindowValue(window, "persona")) {
            this._applyPersona(JSON.parse(
              this._sessionStore.getWindowValue(window, "persona")
            ));
          } else {
            this._applyDefault();
          }
        // Pan-window personas are enabled
        } else {
          if (PersonaService.previewingPersona) {
            this._applyPersona(PersonaService.previewingPersona);
          } else if (PersonaService.selected == "default") {
            this._applyDefault();
          } else {
            this._applyPersona(PersonaService.currentPersona);
          }
          break;
        }
    }
  },

  // nsIDOMEventListener
  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "SelectPersona":
        this.onSelectPersonaFromContent(aEvent);
        break;
      case "PreviewPersona":
        this.onPreviewPersonaFromContent(aEvent);
        break;
      case "ResetPersona":
        this.onResetPersonaFromContent(aEvent);
        break;
      case "CheckPersonas":
        this.onCheckPersonasFromContent(aEvent);
        break;
      case "AddFavoritePersona":
        this.onAddFavoritePersonaFromContent(aEvent);
        break;
      case "RemoveFavoritePersona":
        this.onRemoveFavoritePersonaFromContent(aEvent);
        break;
      case "pagehide":
      case "TabSelect":
        this.onResetPersona();
        break;
    }
  },

  // Tab Monitor methods (Thunderbird)
  onTabTitleChanged : function(aTab) { /* ignored */ },
  onTabSwitched : function(aTab, aOldTab) {
    this.onResetPersona();
  },

  //**************************************************************************//
  // Initialization & Destruction

  startUp: function() {
    // Set the label for the tooltip that informs users when personas data
    // is unavailable.
    // FIXME: make this a DTD entity rather than a properties string.
    document.getElementById("personasDataUnavailableTooltip").label =
      this._strings.get("dataUnavailable",
                        [this._brandStrings.get("brandShortName")]);

    if (!this.LightweightThemeManager) {
      // Observe various changes that we should apply to the browser window.
      this.Observers.add("personas:persona:changed", this);
      this.Observers.add("domwindowopened", this);

      // Listen for various persona-related events that can bubble up from content.
      document.addEventListener("SelectPersona", this, false, true);
      document.addEventListener("PreviewPersona", this, false, true);
      document.addEventListener("ResetPersona", this, false, true);
      window.addEventListener("pagehide", this, false, true);
      // Detect when the selected tab is changed to remove the persona being
      // previewed.
      switch (PersonaService.appInfo.ID) {
        case PersonaService.FIREFOX_ID:
          gBrowser.tabContainer.addEventListener("TabSelect", this, false);
          break;
        case PersonaService.THUNDERBIRD_ID:
          document.getElementById("tabmail").registerTabMonitor(this);
          break;
      }
    }
    // Listen for various persona-related events that can bubble up from content,
    // not handled by the LightweightThemeManager.
    document.addEventListener("CheckPersonas", this, false, true);
    document.addEventListener("AddFavoritePersona", this, false, true);
    document.addEventListener("RemoveFavoritePersona", this, false, true);


    Cu.import("resource://gre/modules/AddonManager.jsm", this);
    this.AddonManager.getAddonByID(PERSONAS_EXTENSION_ID,
      function(aAddon) {
        this._prefs.set("lastversion", aAddon.version);
      }.bind(this));

    // Apply the current persona to the window if the LightweightThemeManager
    // is not available.
    // Also, we don't apply the default persona because Firefox starts with that.
    // Check for per-window personas and restore the persona from session store.
    if (!this.LightweightThemeManager) {
      if (this._prefs.get("perwindow") &&
          this._sessionStore.getWindowValue(window, "persona")) {
        this._applyPersona(JSON.parse(
          this._sessionStore.getWindowValue(window, "persona")
        ));
      } else if (PersonaService.selected != "default") {
        this._applyPersona(PersonaService.currentPersona);
      }
    }

    // Perform special operations for Firefox 4 compatibility:
    // * Hide the status bar button
    // * Install the toolbar button in the Add-on bar (first time only).
    if (PersonaService.appInfo.ID == PersonaService.FIREFOX_ID) {
      let addonBar = window.document.getElementById("addon-bar");
      if (addonBar) {
        this._menuButton.setAttribute("hidden", true);

        if (!this._prefs.get("toolbarButtonInstalled")) {
          this._installToolbarButton(addonBar);
          this._prefs.set("toolbarButtonInstalled", true);
        }
      }
    }
  },

  shutDown: function() {
    if (!this.LightweightThemeManager) {
      this.Observers.remove("personas:persona:changed", this);
      this.Observers.remove("domwindowopened", this);
      document.removeEventListener("SelectPersona", this, false);
      document.removeEventListener("PreviewPersona", this, false);
      document.removeEventListener("ResetPersona", this, false);
      window.removeEventListener("pagehide", this, false);
      switch (PersonaService.appInfo.ID) {
        case PersonaService.FIREFOX_ID:
          gBrowser.tabContainer.removeEventListener("TabSelect", this, false);
          break;
        case PersonaService.THUNDERBIRD_ID:
          document.getElementById("tabmail").unregisterTabMonitor(this);
          break;
      }
    }
    document.removeEventListener("CheckPersonas", this, false);
    document.removeEventListener("AddFavoritePersona", this, false);
    document.removeEventListener("RemoveFavoritePersona", this, false);
  },

  _installToolbarButton : function(aToolbar) {
    const PERSONAS_BUTTON_ID = "personas-toolbar-button";

    let curSet = aToolbar.currentSet;

    // Add the button if it's not in the toolbar's current set
    if (-1 == curSet.indexOf(PERSONAS_BUTTON_ID)) {

      // Insert the button at the end.
      let newSet = curSet + "," + PERSONAS_BUTTON_ID;

      aToolbar.currentSet = newSet;
      aToolbar.setAttribute("currentset", newSet);
      document.persist(aToolbar.id, "currentset");

      try {
        BrowserToolboxCustomizeDone(true);
      }
      catch(e){}

      // Make sure the toolbar is visible
      if (aToolbar.getAttribute("collapsed") == "true")
        aToolbar.setAttribute("collapsed", "false");
      document.persist(aToolbar.id, "collapsed");
    }
  },

  //**************************************************************************//
  // Appearance Updates

  _applyPersona: function(persona) {

    // Style header and footer
    this._header.setAttribute("persona", persona.id);
    this._footer.setAttribute("persona", persona.id);

    // First try to obtain the images from the cache
    let images = PersonaService.getCachedPersonaImages(persona);
    if (images && images.header && images.footer) {
      this._header.style.backgroundImage = "url(" + images.header + ")";
      this._footer.style.backgroundImage = "url(" + images.footer + ")";
    }
    // Else set them from their original source
    else {
      // Use the URI module to resolve the possibly relative URI to an absolute one.
      let headerURI = this.URI.get(persona.headerURL || persona.header,
                                   null,
                                   this.URI.get(PersonaService.dataURL));
      this._header.style.backgroundImage = "url(" + this._escapeURLForCSS(headerURI.spec) + ")";
      // Use the URI module to resolve the possibly relative URI to an absolute one.
      let footerURI = this.URI.get(persona.footerURL || persona.footer,
                                   null,
                                   this.URI.get(PersonaService.dataURL));
      this._footer.style.backgroundImage = "url(" + this._escapeURLForCSS(footerURI.spec) + ")";
    }

    // Style the text color.
    if (this._prefs.get("useTextColor")) {
      // FIXME: fall back on the default text color instead of "black".
      let textColor = persona.textcolor || "black";
      this._header.style.color = textColor;
      for (let i = 0; i < document.styleSheets.length; i++) {
        let styleSheet = document.styleSheets[i];
        if (styleSheet.href == "chrome://personas/content/overlay.css") {
          while (styleSheet.cssRules.length > 0)
            styleSheet.deleteRule(0);

          // On Mac we do several things differently:
          // 1. make text be regular weight, not bold (not sure why);
          // 2. explicitly style the Find toolbar label ("Find:" or
          //    "Quick Find:" in en-US) and status message ("Phrase not found"),
          //    which otherwise would be custom colors specified in findBar.css
          //    (note: we only do this in Firefox);
          // 3. style the tab color (Mac tabs are transparent).
          // In order to style the Find toolbar text, we have to both explicitly
          // reference it (.findbar-find-fast, .findbar-find-status) and make
          // the declaration !important to override an !important declaration
          // for the status text in findBar.css.
          // XXX Isn't |#main-window[persona]| unnecessary in this rule,
          // given that the rule is only inserted into the stylesheet when
          // a persona is active?
          if (PersonaService.appInfo.OS == "Darwin") {
            switch (PersonaService.appInfo.ID) {
              case PersonaService.FIREFOX_ID:
                styleSheet.insertRule(
                  "#main-window[persona] .tabbrowser-tab, " +
                  "#navigator-toolbox menubar > menu, " +
                  "#navigator-toolbox toolbarbutton, " +
                  "#browser-bottombox, " +
                  ".findbar-find-fast, " +
                  ".findbar-find-status, " +
                  "#browser-bottombox toolbarbutton " +
                  "{ color: inherit; " +
                  "font-weight: normal; }",
                  0
                );
                break;
              case PersonaService.THUNDERBIRD_ID:
                styleSheet.insertRule(
                  ".tabmail-tab, " +
                  "#mail-toolbox menubar > menu, " +
                  "#mail-toolbox toolbarbutton, " +
                  "#mail-toolbox toolbaritem > label, " +
                  "#status-bar " +
                  "{ color: " + textColor + " !important; " +
                  "font-weight: normal; }",
                  0
                );
                break;
              default:
                break;
            }
          }
          else {
            switch (PersonaService.appInfo.ID) {
              case PersonaService.FIREFOX_ID:
                styleSheet.insertRule(
                  "#navigator-toolbox menubar > menu, " +
                  "#navigator-toolbox toolbarbutton, " +
                  "#browser-bottombox, " +
                  "#browser-bottombox toolbarbutton " +
                  "{ color: inherit; }",
                  0
                );
                break;
              case PersonaService.THUNDERBIRD_ID:
                styleSheet.insertRule(
                  "#mail-toolbox menubar > menu, " +
                  "#mail-toolbox toolbarbutton, " +
                  "#mail-toolbox toolbaritem > label, " +
                  "#status-bar " +
                  "{ color: " + textColor + "}",
                  0
                );
                break;
              default:
                break;
            }
          }

          // FIXME: figure out what to do about the disabled color.  Maybe we
          // should let personas specify it independently and then apply it via
          // a rule like this:
          // #navigator-toolbox toolbarbutton[disabled="true"],
          // #browser-toolbox toolbarbutton[disabled="true"],
          // #browser-bottombox toolbarbutton[disabled="true"]
          //   { color: #cccccc !important; }

          // Stop iterating through stylesheets.
          break;
        }
      }
    }

    // Style the titlebar with the accent color.
    if (this._prefs.get("useAccentColor")) {
      let general, active, inactive;
      if (persona.accentcolor) {
        general  = persona.accentcolor;
        active   = persona.accentcolor;
        inactive = persona.accentcolor;
      }
      else {
        general  = "";
        active   = "";
        inactive = "";
      }
      this._setTitlebarColors(general, active, inactive);
    }

    // Opacity overrides (firefox only)
    if (PersonaService.appInfo.ID == PersonaService.FIREFOX_ID) {
      let overrideOpacity = this._prefs.get("override.opacity");
      let overrideActiveOpacity = this._prefs.get("override.activeOpacity");
      for (let i = 0; i < document.styleSheets.length; i++) {
        let styleSheet = document.styleSheets[i];
        if (styleSheet.href == "chrome://personas/content/overlay.css") {
          if (typeof(overrideOpacity) != "undefined") {
            styleSheet.insertRule(
              "#main-window[persona] .tabbrowser-tab " +
              "{ opacity: " + overrideOpacity + " !important; }",
              0
            );
          }
          if (typeof(overrideActiveOpacity) != "undefined") {
            styleSheet.insertRule(
              "#main-window[persona] .tabbrowser-tab[selected=\"true\"] " +
              "{ opacity: " + overrideActiveOpacity + " !important; }",
              0
            );
            styleSheet.insertRule(
              "#main-window[persona] #urlbar, " +
              "#main-window[persona] #searchbar " +
              "{ opacity: " + overrideActiveOpacity + " !important; }",
              0
            );
          }
          break;
        }
      }
    }

  },

  _applyDefault: function() {
    // Reset the header.
    this._header.removeAttribute("persona");
    this._header.style.backgroundImage = "";

    // Reset the footer.
    this._footer.removeAttribute("persona");
    this._footer.style.backgroundImage = "";

    // Reset the text color.
    for (let i = 0; i < document.styleSheets.length; i++) {
      let styleSheet = document.styleSheets[i];
      if (styleSheet.href == "chrome://personas/content/overlay.css") {
        while (styleSheet.cssRules.length > 0)
          styleSheet.deleteRule(0);
        break;
      }
    }
    this._header.style.color = "";

    // Reset the titlebar color.
    if (this._prefs.get("useAccentColor")) {
      this._setTitlebarColors("", "", "");
    }
  },

  _setTitlebarColors: function(general, active, inactive) {
    // Titlebar colors only have an effect on Mac.
    if (PersonaService.appInfo.OS != "Darwin")
      return;

    let changed = false;

    if (general != this._header.getAttribute("titlebarcolor")) {
      document.documentElement.setAttribute("titlebarcolor", general);
      changed = true;
    }
    if (active != this._header.getAttribute("activetitlebarcolor")) {
      document.documentElement.setAttribute("activetitlebarcolor", active);
      changed = true;
    }
    if (inactive != this._header.getAttribute("inactivetitlebarcolor")) {
      document.documentElement.setAttribute("inactivetitlebarcolor", inactive);
      changed = true;
    }

    if (changed && PersonaService.appInfo.platformVersion.indexOf("1.9.0") == 0) {
      // FIXME: Incredibly gross hack in order to force a window redraw event
      // that ensures that the titlebar color change is applied. We only have to
      // do this for Firefox 3.0 (Gecko 1.9.0) because bug 485451 on the problem
      // has been fixed for Firefox 3.5 (Gecko 1.9.1).
      //
      // This will unmaximize a maximized window on Windows and Linux,
      // but we only do this on Mac (which is the only place
      // the "titlebarcolor" attribute has any effect anyway at the moment),
      // so that's ok for now.
      //
      // This will unminimize a minimized window on Mac, so we can't do it
      // if the window is minimized.
      if (window.windowState != Ci.nsIDOMChromeWindow.STATE_MINIMIZED) {
        window.resizeTo(parseInt(window.outerWidth)+1, window.outerHeight);
        window.resizeTo(parseInt(window.outerWidth)-1, window.outerHeight);
      }
    }
  },


  //**************************************************************************//
  // Persona Selection, Preview, and Reset

  /**
   * Select the persona specified by a web page via a SelectPersona event.
   * Checks to ensure the page is hosted on a server authorized to select personas.
   *
   * @param event   {Event}
   *        the SelectPersona DOM event
   */
  onSelectPersonaFromContent: function(event) {
    this._authorizeHost(event);
    this.onSelectPersona(event);
  },

  /**
   * Select the persona specified by the DOM node target of the given event.
   *
   * @param event   {Event}
   *        the SelectPersona DOM event
   */
  onSelectPersona: function(event) {
    let node = event.target;

    if (!node.hasAttribute("persona"))
      throw "node does not have 'persona' attribute";

    let persona = node.getAttribute("persona");

    // We check if the user wants per-window personas
    if (this._prefs.get("perwindow")) {
      // Since per-window personas are window-specific, we persist and
      // set them from here instead instead of going through PersonaService.
      switch (persona) {
        // We store the persona in the "persona" window property, and do not
        // have a seperate type as is the case with pan-window personas. This
        // is because we currently support only a single type of persona in
        // per-window mode. We'll add a new type property when we support
        // other types of selectable personas, such as "random".
        case "default":
          this._applyDefault();
          this._sessionStore.setWindowValue(window, "persona", "default");
          break;
        default:
          this._applyPersona(JSON.parse(persona));
          this._sessionStore.setWindowValue(window, "persona", persona);
          break;
      }
    // Usual, pan-window persona mode
    } else {
      // The persona attribute is either a JSON string specifying the persona
      // to apply or a string identifying a special persona (default, random).
      switch (persona) {
        case "default":
          PersonaService.changeToDefaultPersona();
          break;
        case "random":
          PersonaService.changeToRandomPersona(node.getAttribute("category"));
          break;
        case "custom":
          PersonaService.changeToPersona(PersonaService.customPersona);
          break;
        default:
          PersonaService.changeToPersona(JSON.parse(persona));
          break;
      }
    }
  },

  /**
   * Preview the persona specified by a web page via a PreviewPersona event.
   * Checks to ensure the page is hosted on a server authorized to set personas.
   *
   * @param   event   {Event}
   *          the PreviewPersona DOM event
   */
  onPreviewPersonaFromContent: function(event) {
    this._authorizeHost(event);
    this.onPreviewPersona(event);
  },

  onPreviewPersona: function(event) {
    if (!this._prefs.get("previewEnabled"))
      return;

    if (!event.target.hasAttribute("persona"))
      throw "node does not have 'persona' attribute";

    //this._previewPersona(event.target.getAttribute("persona"));
    let persona = JSON.parse(event.target.getAttribute("persona"));

    // We check if the user wants per-window personas
    if (this._prefs.get("perwindow")) {
      // We temporarily set the window specific persona here and let
      // onResetPersona reset it.
      switch (persona) {
        case "default":
          this._applyDefault();
          break;
        default:
          this._applyPersona(persona);
          break;
      }
    } else {
      if (this._resetTimeoutID) {
        window.clearTimeout(this._resetTimeoutID);
        this._resetTimeoutID = null;
      }

      let t = this;
      let persona = JSON.parse(event.target.getAttribute("persona"));
      let callback = function() { t._previewPersona(persona) };
      this._previewTimeoutID =
        window.setTimeout(callback, this._previewTimeout);
    }
  },

  _previewPersona: function(persona) {
    PersonaService.previewPersona(persona);
  },

  /**
   * Reset the persona as specified by a web page via a ResetPersona event.
   * Checks to ensure the page is hosted on a server authorized to reset personas.
   *
   * @param event   {Event}
   *        the ResetPersona DOM event
   */
  onResetPersonaFromContent: function(event) {
    this._authorizeHost(event);
    this.onResetPersona();
  },

  onResetPersona: function(event) {
    if (!this._prefs.get("previewEnabled"))
      return;

    //this._resetPersona();
    // If per-window personas are enabled and there's a valid persona
    // value set for this window, don't reset.
    if (this._prefs.get("perwindow") &&
      this._sessionStore.getWindowValue(window, "persona")) {
      return;
    }

    if (this._previewTimeoutID) {
      window.clearTimeout(this._previewTimeoutID);
      this._previewTimeoutID = null;
    }

    let t = this;
    let callback = function() { t._resetPersona() };
    this._resetTimeoutID = window.setTimeout(callback, this._previewTimeout);
  },

  _resetPersona: function() {
    PersonaService.resetPersona();
  },

  /**
   * Confirm that Firefox has this Personas extension when requested by
   * a web page via a CheckPersonas event.  Checks to ensure the page is hosted
   * on a host in the whitelist before responding to the event, so only
   * whitelisted pages can find out if Personas is installed.
   *
   * @param event   {Event}
   *        the CheckPersonas DOM event
   */
  onCheckPersonasFromContent: function(event) {
    this._authorizeHost(event);
    event.target.setAttribute("personas", "true");
  },

  onSelectPreferences: function() {
    window.openDialog('chrome://personas/content/preferences.xul', '',
                      'chrome,titlebar,toolbar,centerscreen');
  },

  onViewDirectory: function() {
    this.openURLInTab(this._siteURL + "gallery/All/Popular");
  },

  onEditCustomPersona: function() {
    this.openURLInTab("chrome://personas/content/customPersonaEditor.xul");
  },

  /**
   * Adds the favorite persona specified by a web page via a AddFavoritePersona event.
   * Checks to ensure the page is hosted on a server authorized to select personas.
   *
   * @param event   {Event}
   *        the AddFavoritePersona DOM event
   */
  onAddFavoritePersonaFromContent: function(event) {
    this._authorizeHost(event);
    this.onAddFavoritePersona(event);
  },

  /**
   * Adds the persona specified by the DOM node target of the given event to
   * the favorites list.
   *
   * @param event   {Event}
   *        the AddFavoritePersona DOM event
   */
  onAddFavoritePersona: function(event) {
    let node = event.target;

    if (!node.hasAttribute("persona"))
      throw "node does not have 'persona' attribute";

    let persona = node.getAttribute("persona");
    PersonaService.addFavoritePersona(JSON.parse(persona));
  },

  /**
   * Removes the favorite persona specified by a web page via a
   * RemoveFavoritePersona event.
   * Checks to ensure the page is hosted on a server authorized to select personas.
   *
   * @param event   {Event}
   *        the RemoveFavoritePersona DOM event
   */
  onRemoveFavoritePersonaFromContent: function(event) {
    this._authorizeHost(event);
    this.onRemoveFavoritePersona(event);
  },

  /**
   * Removes the persona specified by the DOM node target of the given event
   * from the favorites list.
   *
   * @param event   {Event}
   *        the RemoveFavoritePersona DOM event
   */
  onRemoveFavoritePersonaFromContent: function(event) {
    let node = event.target;

    if (!node.hasAttribute("persona"))
      throw "node does not have 'persona' attribute";

    let persona = node.getAttribute("persona");
    PersonaService.removeFavoritePersona(JSON.parse(persona));
  },

  /**
   * Ensure the host that loaded the document from which the given DOM event
   * came matches an entry in the personas whitelist.  The host matches if it
   * equals one of the entries in the whitelist.  For example, if
   * www.mozilla.com is an entry in the whitelist, then www.mozilla.com matches,
   * but labs.mozilla.com, mozilla.com, and evil.com do not.
   *
   * @param aEvent {Event} the DOM event
   */
  _authorizeHost: function(aEvent) {
    let host = aEvent.target.ownerDocument.location.hostname;
    let authorizedHosts = this._prefs.get("authorizedHosts").split(/[, ]+/);
    if (!authorizedHosts.some(function(v) v == host))
      throw host + " not authorized to modify personas";
  },


  //**************************************************************************//
  // Popup Construction

  onMenuButtonMouseDown: function(event) {
    // If the menu popup isn't on the menu button, then move the popup
    // onto the button so the popup appears when the user clicks it.
    // We'll move the popup back onto the Personas menu in the Tools menu
    // when the popup hides.
    // FIXME: remove this workaround once bug 461899 is fixed.
    if (this._menuPopup.parentNode != this._menuButton)
      this._menuButton.appendChild(this._menuPopup);
  },

  onToolbarButtonMouseDown: function(event) {
    // If the menu popup isn't on the toolbar button, then move the popup
    // onto the button so the popup appears when the user clicks it.
    // We'll move the popup back onto the Personas menu in the Tools menu
    // when the popup hides.
    // FIXME: remove this workaround once bug 461899 is fixed.
    if (this._menuPopup.parentNode != this._toolbarButton)
      this._toolbarButton.appendChild(this._menuPopup);
  },

  onPopupShowing: function(event) {
    if (event.target == this._menuPopup)
      this._rebuildMenu();

    return true;
  },

  onPopupHiding: function(event) {
    if (event.target == this._menuPopup) {
      // If the menu popup isn't on the Personas menu in the Tools menu,
      // then move the popup back onto that menu so the popup appears when
      // the user selects it.  We'll move the popup back onto the menu button
      // in onMenuButtonMouseDown when the user clicks on the menu button.
      if (this._menuPopup.parentNode != this._menu) {
        this._menuPopup.parentNode.removeAttribute("open");
        this._menu.appendChild(this._menuPopup);
      }
    }
  },

  _rebuildMenu: function() {
    // If we don't have personas data, we won't be able to fully build the menu,
    // and we'll display a message to that effect in tooltips over the parts
    // of the menu that are data-dependent (the Most Popular, New, and
    // By Category submenus).  The message also suggests that the user try again
    // in a few minutes, so here we immediately try to refresh data so it will
    // be available when the user tries again.
    if (!PersonaService.personas)
      PersonaService.refreshData();

    let openingSeparator = document.getElementById("personasOpeningSeparator");
    let closingSeparator = document.getElementById("personasClosingSeparator");

    // Remove everything between the two separators.
    while (openingSeparator.nextSibling && openingSeparator.nextSibling != closingSeparator)
      this._menuPopup.removeChild(openingSeparator.nextSibling);

    // Update the item that identifies the current persona.
    let personaStatus = document.getElementById("persona-current");
    let name = PersonaService.currentPersona ? PersonaService.currentPersona.name
                                             : this._strings.get("unnamedPersona");

    personaStatus.setAttribute("class", "menuitem-iconic");

    if (PersonaService.selected == "random") {
      personaStatus.setAttribute("label", this._strings.get("randomPersona", [PersonaService.category, name]));
      personaStatus.setAttribute("image", PersonaService.currentPersona.dataurl ? PersonaService.currentPersona.dataurl
                                          : "chrome://personas/content/personas_16x16.png");

    } if (PersonaService.selected == "default") {
      personaStatus.setAttribute("label", this._strings.get("Default"));
      personaStatus.removeAttribute("image");
      personaStatus.removeAttribute("menuitem-iconic");
    } else {
      personaStatus.setAttribute("label", name);
      personaStatus.setAttribute("image", PersonaService.currentPersona.dataurl ? PersonaService.currentPersona.dataurl
                                          : "chrome://personas/content/personas_16x16.png");
    }

    let personaStatusDetail = document.getElementById("persona-current-view-detail");
    personaStatusDetail.setAttribute("disabled", PersonaService.currentPersona.detailURL ? "false" : "true");
    personaStatusDetail.setAttribute("label", this._strings.get("viewDetail"));
    personaStatusDetail.setAttribute("oncommand", "PersonaController.openURLInTab(this.getAttribute('href'))");
    personaStatusDetail.setAttribute("href", PersonaService.currentPersona.detailURL);

    let personaStatusDesigner = document.getElementById("persona-current-view-designer");
    // collapse the "More From User" menu item for custom personas or personas
    // with null username. In this case we only check the username is not null
    // because it is used to generate the url to go to the personas designer page
    // (bug 526788).
    if (PersonaService.currentPersona.custom || !PersonaService.currentPersona.username) {
      personaStatusDesigner.setAttribute("collapsed", true);
    } else {
      personaStatusDesigner.removeAttribute("collapsed");
      let designerLabel = PersonaService.currentPersona.author ?
                            PersonaService.currentPersona.author : PersonaService.currentPersona.username;
      personaStatusDesigner.setAttribute("label", this._strings.get("viewDesigner", [designerLabel]));
      let designerURL = this._siteURL + "gallery/Designer/" + PersonaService.currentPersona.username;
      personaStatusDesigner.setAttribute("oncommand", "PersonaController.openURLInTab(this.getAttribute('href'))");
      personaStatusDesigner.setAttribute("href", designerURL);
    }

    // Update the checkmark on the Default menu item.
    document.getElementById("defaultPersona").setAttribute("checked", (PersonaService.selected == "default" ? "true" : "false"));

    // FIXME: factor out the duplicate code below.

    // Create the Favorites menu.
    {
      let menu = document.createElement("menu");
      menu.setAttribute("label", this._strings.get("favorites"));

      let popupmenu = menu.appendChild(document.createElement("menupopup"));

      if (!PersonaService.isUserSignedIn) {
        let item = popupmenu.appendChild(document.createElement("menuitem"));
        item.setAttribute("label", this._strings.get("favoritesSignIn"));
        item.setAttribute("oncommand", "PersonaController.openURLInTab(this.getAttribute('href'))");
        item.setAttribute("href", this._siteURL + "signin?return=/gallery/All/Favorites");
      } else {

        if (PersonaService.favorites) {
          for each (let persona in PersonaService.favorites)
            popupmenu.appendChild(this._createPersonaItem(persona));
          popupmenu.appendChild(document.createElement("menuseparator"));
        }

        // Disable random from favorites menu item if per-window
        // personas are enabled
        if (!this._prefs.get("perwindow")) {
          let item = popupmenu.appendChild(document.createElement("menuitem"));
          item.setAttribute("label", this._strings.get("useRandomPersona", [this._strings.get("favorites")]));
//        item.setAttribute("type", "checkbox");
          item.setAttribute("checked", (PersonaService.selected == "randomFavorite"));
          item.setAttribute("autocheck", "false");
          item.setAttribute("oncommand", "PersonaController.toggleFavoritesRotation()");
        }

        // go to my favorites menu item
        item = popupmenu.appendChild(document.createElement("menuitem"));
        item.setAttribute("label", this._strings.get("favoritesGoTo"));
        item.setAttribute("oncommand", "PersonaController.openURLInTab(this.getAttribute('href'))");
        item.setAttribute("href", this._siteURL + "gallery/All/Favorites");
      }

      this._menuPopup.insertBefore(menu, closingSeparator);
    }

    // Create the "Recently Selected" menu.
    {
      let menu = document.createElement("menu");
      menu.setAttribute("label", this._strings.get("recent"));
      let popupmenu = document.createElement("menupopup");

      let recentPersonas = PersonaService.getRecentPersonas();
      for each (let persona in recentPersonas) {
        popupmenu.appendChild(this._createPersonaItem(persona));
      }

      menu.appendChild(popupmenu);
      this._menuPopup.insertBefore(menu, closingSeparator);
      this._menuPopup.insertBefore(document.createElement("menuseparator"), closingSeparator);
    }

    // Create the New & Featured menu.
    {
      let menu = document.createElement("menu");
      menu.setAttribute("label", this._strings.get("new"));

      if (PersonaService.personas) {
        let popupmenu = document.createElement("menupopup");
        for each (let persona in PersonaService.personas.featured)
          popupmenu.appendChild(this._createPersonaItem(persona));

        // Create an item that picks a random persona from the category.
        // Disable random from category menu item if per-window
        // personas are enabled.
        if (!this._prefs.get("perwindow")) {
          popupmenu.appendChild(document.createElement("menuseparator"));
          popupmenu.appendChild(this._createRandomItem(this._strings.get("new"), "new"));
        }

        // Create an item that links to the gallery for this category.
        popupmenu.appendChild(
          this._createViewMoreItem(this._strings.get("new"),
                                   PersonaService.personas.total,
                                   "new"));

        menu.appendChild(popupmenu);
      }
      else {
        menu.setAttribute("disabled", "true");
        menu.setAttribute("tooltip", "personasDataUnavailableTooltip");
      }

      this._menuPopup.insertBefore(menu, closingSeparator);
    }

    // Create the Most Popular menu.
    {
      let menu = document.createElement("menu");
      menu.setAttribute("label", this._strings.get("popular"));

      if (PersonaService.personas) {
        let popupmenu = document.createElement("menupopup");
        for each (let persona in PersonaService.personas.popular)
          popupmenu.appendChild(this._createPersonaItem(persona));

        // Create an item that picks a random persona from the category.
        // Disable random from favorites menu item if per-window
        // personas are enabled.
        if (!this._prefs.get("perwindow")) {
          popupmenu.appendChild(document.createElement("menuseparator"));
          popupmenu.appendChild(this._createRandomItem(this._strings.get("popular"), "popular"));
        }

        // Create an item that links to the gallery for this category.
        popupmenu.appendChild(this._createViewMoreItem(this._strings.get("popular"),
                              42 - PersonaService.personas.popular.length,
                              "popular"));

        menu.appendChild(popupmenu);
      }
      else {
        menu.setAttribute("disabled", "true");
        menu.setAttribute("tooltip", "personasDataUnavailableTooltip");
      }

      this._menuPopup.insertBefore(menu, closingSeparator);
    }

    // Create the Categories menu.
    let categoriesMenu = document.createElement("menu");
    if (PersonaService.personas) {
      let categoriesPopup = document.createElement("menupopup");

      // Create the category-specific submenus.
      for each (let category in PersonaService.personas.categories) {
        let menu = document.createElement("menu");
        menu.setAttribute("label", category.name + " (" + (+category.total).toLocaleString() + ")");
        let popupmenu = document.createElement("menupopup");

        for each (let persona in category.personas)
          popupmenu.appendChild(this._createPersonaItem(persona));

        // Create an item that picks a random persona from the category.
        // Disable random from favorites menu item if per-window
        // personas are enabled
        if (!this._prefs.get("perwindow")) {
          popupmenu.appendChild(document.createElement("menuseparator"));
          popupmenu.appendChild(this._createRandomItem(category.name));
        }

        // Create an item that links to the gallery for this category.
        popupmenu.appendChild(this._createViewMoreItem(category.name,
                                                       category.total - category.personas.length));

        menu.appendChild(popupmenu);
        categoriesPopup.appendChild(menu);
      }
      categoriesMenu.setAttribute("label", this._strings.get("categories") +
                                  " (" + (+PersonaService.personas.total).toLocaleString() + ")");
      categoriesMenu.appendChild(categoriesPopup);
    }
    else {
      categoriesMenu.setAttribute("label", this._strings.get("categories"));
      categoriesMenu.setAttribute("disabled", "true");
      categoriesMenu.setAttribute("tooltip", "personasDataUnavailableTooltip");
    }

    this._menuPopup.insertBefore(categoriesMenu, closingSeparator);

    // Update the Custom menu. Custom personas unavailable in per-window
    // personas mode.
    let customMenu = document.getElementById("personas-plus-custom-menu");
    customMenu.hidden = true;
    if (!this._prefs.get("perwindow") && this._prefs.get("showCustomMenu")) {
       let name = PersonaService.customPersona &&
                   PersonaService.customPersona.name ? PersonaService.customPersona.name
                                                     : this._strings.get("customPersona");
       customMenu.setAttribute("label", name);
       customMenu.hidden = false;
    }
  },

  _createPersonaItem: function(persona) {
    let item = document.createElement("menuitem");

    let headerURI;
    if (persona.custom) {
      headerURI = persona.headerURL || persona.header;
    } else {
      headerURI = persona.dataurl || persona.iconURL;
    }

    item.setAttribute("class", "menuitem-iconic");
    item.setAttribute("image", headerURI);
    item.setAttribute("label", persona.name);
//    item.setAttribute("type", "checkbox");
    item.setAttribute("checked", (PersonaService.selected != "default" &&
                                  PersonaService.currentPersona &&
                                  PersonaService.currentPersona.id == persona.id));
    item.setAttribute("autocheck", "false");
    item.setAttribute("oncommand", "PersonaController.onSelectPersona(event)");
    item.setAttribute("recent", persona.recent ? "true" : "false");
    item.setAttribute("persona", JSON.stringify(persona));
    item.addEventListener("DOMMenuItemActive", function(evt) { PersonaController.onPreviewPersona(evt) }, false);
    item.addEventListener("DOMMenuItemInactive", function(evt) { PersonaController.onResetPersona(evt) }, false);

    return item;
  },

  _createViewMoreItem: function(category, number, categoryId) {
    let item = document.createElement("menuitem");

    item.setAttribute("class", "menuitem-iconic");
    item.setAttribute("label", this._strings.get("viewMore", [(+number).toLocaleString(), category]));
    item.setAttribute("oncommand", "PersonaController.openURLInTab(this.getAttribute('href'))");

    if (categoryId == "popular") {
      item.setAttribute("href", this._siteURL + "gallery/All/Popular");
    }
    else if (categoryId == "new") {
      item.setAttribute("href", this._siteURL + "gallery/All/Recent");
    }
    else {
      item.setAttribute("href", this._siteURL + "gallery/" + category + "/All");
    }

    return item;
  },

  _createRandomItem: function(aCategoryName, aCategory) {
    let item = document.createElement("menuitem");

    item.setAttribute("class", "menuitem-iconic");
    item.setAttribute("label", this._strings.get("useRandomPersona", [aCategoryName]));
    item.setAttribute("oncommand", "PersonaController.onSelectPersona(event)");
    item.setAttribute("persona", "random");
    item.setAttribute("category", aCategory || aCategoryName);

    return item;
  },

  toggleFavoritesRotation : function() {
    if (PersonaService.selected != "randomFavorite") {
      PersonaService.selected = "randomFavorite";
    } else {
      PersonaService.selected = "current";
    }
  }
};

// Import generic modules into the persona controller rather than
// the global namespace so they don't conflict with modules with the same names
// imported by other extensions.
Cu.import("resource://personas/modules/Observers.js",     PersonaController);
Cu.import("resource://personas/modules/Preferences.js",   PersonaController);
Cu.import("resource://personas/modules/StringBundle.js",  PersonaController);
Cu.import("resource://personas/modules/URI.js",           PersonaController);

// Import modules that come with Firefox into the persona controller rather
// than the global namespace.
// LightweightThemeManager may not be not available (Firefox < 3.6 or Thunderbird)
try { Cu.import("resource://gre/modules/LightweightThemeManager.jsm", PersonaController); }
catch (e) {}

window.addEventListener("load", function(e) { PersonaController.startUp(e) }, false);
window.addEventListener("unload", function(e) { PersonaController.shutDown(e) }, false);
