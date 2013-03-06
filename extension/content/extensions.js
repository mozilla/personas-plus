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

// Run this overlay only on Firefox 3.6.*
const FIREFOX_ID = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
var appInfo =
  Components.classes["@mozilla.org/xre/app-info;1"].
    getService(Components.interfaces.nsIXULAppInfo);
var versionChecker =
  Components.classes["@mozilla.org/xpcom/version-comparator;1"].
    getService(Components.interfaces.nsIVersionComparator);

if (appInfo.ID == FIREFOX_ID &&
    versionChecker.compare(appInfo.version, "3.6") >= 0 &&
    versionChecker.compare(appInfo.version, "3.6.*") < 0)
{
  // Load the Personas string bundle, used to set the label of the default persona.
  Components.utils.import("resource://personas/modules/StringBundle.js", gExtensionsViewController);
  gExtensionsViewController.getStrings = function() {
    delete this._strings;
    return this._strings = new this.StringBundle("chrome://personas/locale/personas.properties");
  };

  const DEFAULT_PERSONA_ID = 0;
  const CUSTOM_PERSONA_ID = 1;

  /**
   * Overriden method from Firefox extensions.js. Enables cmd_useTheme for
   * Persona entries.
   */
  gExtensionsViewController.isCommandEnabled = function (aCommand) {
    var selectedItem = gExtensionsView.selectedItem;
    if (!selectedItem)
      return false;

    if (selectedItem.hasAttribute("downloadURL") &&
        selectedItem.getAttribute("downloadURL") != "") {
      if (aCommand == "cmd_uninstall")
        return true;
      return false;
    }
    switch (aCommand) {
    case "cmd_installSearchResult":
      return selectedItem.getAttribute("action") == "" ||
             selectedItem.getAttribute("action") == "failed";

    // Changed from original extensions.js
    // Enables the cmd_useTheme command for the "Default Persona"
    // when another Persona is set.
    case "cmd_useTheme":
      if (selectedItem.hasAttribute("lwtheme")) {
        let personaId = selectedItem.getAttribute("addonID");
        if (personaId == DEFAULT_PERSONA_ID)
          return (gLWThemeToSelect != null);
        return (!gLWThemeToSelect || personaId != gLWThemeToSelect.id);
      }
      return selectedItem.type == nsIUpdateItem.TYPE_THEME &&
             !selectedItem.isDisabled &&
             selectedItem.opType != OP_NEEDS_UNINSTALL &&
             gThemeToSelect != selectedItem.getAttribute("internalName");

    case "cmd_options":
      return selectedItem.type == nsIUpdateItem.TYPE_EXTENSION &&
             !selectedItem.isDisabled &&
             !gInSafeMode &&
             !selectedItem.opType &&
             selectedItem.getAttribute("optionsURL") != "";

    // Changed from original extensions.js
    // Disables the cmd_About command for the "Default Persona"
    case "cmd_about":
      if (selectedItem.hasAttribute("lwtheme"))
        return (selectedItem.getAttribute("addonID") != DEFAULT_PERSONA_ID);
      return selectedItem.opType != OP_NEEDS_INSTALL &&
             selectedItem.getAttribute("plugin") != "true";

    case "cmd_homepage":
      return selectedItem.getAttribute("homepageURL") != "";

    // Changed from original extensions.js
    // Disables the cmd_uninstall command for the "Default Persona"
    case "cmd_uninstall":
      if (selectedItem.hasAttribute("lwtheme") &&
          selectedItem.getAttribute("addonID") != DEFAULT_PERSONA_ID)
        return true;
      return (selectedItem.type != nsIUpdateItem.TYPE_THEME ||
             selectedItem.type == nsIUpdateItem.TYPE_THEME &&
             selectedItem.getAttribute("internalName") != gDefaultTheme) &&
             selectedItem.opType != OP_NEEDS_UNINSTALL &&
             selectedItem.getAttribute("locked") != "true" &&
             canWriteToLocation(selectedItem) &&
             !gExtensionsView.hasAttribute("update-operation");

    case "cmd_cancelUninstall":
      return selectedItem.opType == OP_NEEDS_UNINSTALL;
    case "cmd_cancelInstall":
      return selectedItem.getAttribute("action") == "installed" &&
             gView == "search" || selectedItem.opType == OP_NEEDS_INSTALL;
    case "cmd_cancelUpgrade":
      return selectedItem.opType == OP_NEEDS_UPGRADE;
    case "cmd_checkUpdate":
      return selectedItem.getAttribute("updateable") != "false" &&
             !gExtensionsView.hasAttribute("update-operation");
    case "cmd_installUpdate":
      return selectedItem.hasAttribute("availableUpdateURL") &&
             !gExtensionsView.hasAttribute("update-operation");
    case "cmd_includeUpdate":
      return selectedItem.hasAttribute("availableUpdateURL") &&
             !gExtensionsView.hasAttribute("update-operation");
    case "cmd_reallyEnable":
    // controls whether to show Enable or Disable in extensions' context menu
      return selectedItem.isDisabled &&
             selectedItem.opType != OP_NEEDS_ENABLE ||
             selectedItem.opType == OP_NEEDS_DISABLE;
    case "cmd_enable":
      return selectedItem.type != nsIUpdateItem.TYPE_THEME &&
             (selectedItem.isDisabled ||
             (!selectedItem.opType ||
             selectedItem.opType == OP_NEEDS_DISABLE)) &&
             !selectedItem.isBlocklisted &&
             (!gCheckUpdateSecurity || selectedItem.providesUpdatesSecurely) &&
             (!gCheckCompat || selectedItem.isCompatible) &&
             selectedItem.satisfiesDependencies &&
             !gExtensionsView.hasAttribute("update-operation");
    case "cmd_disable":
      return selectedItem.type != nsIUpdateItem.TYPE_THEME &&
             (!selectedItem.isDisabled &&
             !selectedItem.opType ||
             selectedItem.opType == OP_NEEDS_ENABLE) &&
             !selectedItem.isBlocklisted &&
             selectedItem.satisfiesDependencies &&
             !gExtensionsView.hasAttribute("update-operation");
    }
    return false;
  };

  /**
   * Overriden method from Firefox extensions.js. Removes the restriction which
   * removed personas when themes were applied.
   */
  gExtensionsViewController.commands.cmd_useTheme = function (aSelectedItem) {
    if (aSelectedItem.hasAttribute("lwtheme")) {
      let newTheme = LightweightThemeManager.getUsedTheme(aSelectedItem.getAttribute("addonID"));

      if (newTheme && newTheme.id == CUSTOM_PERSONA_ID &&
          LightweightThemeManager.setLocalTheme) {
        LightweightThemeManager.setLocalTheme(newTheme);
        gLWThemeToSelect = newTheme;
      }
      else
        LightweightThemeManager.currentTheme = gLWThemeToSelect = newTheme;

      if (gPref.prefHasUserValue(PREF_LWTHEME_TO_SELECT)) {
        clearRestartMessage();
        setRestartMessage(aSelectedItem);
      }
    }
    else {
      gThemeToSelect = aSelectedItem.getAttribute("internalName");

      // If choosing the current skin just reset the pending change
      if (gThemeToSelect == gCurrentTheme) {
        if (gPref.prefHasUserValue(PREF_EXTENSIONS_DSS_SWITCHPENDING))
          gPref.clearUserPref(PREF_EXTENSIONS_DSS_SWITCHPENDING);
        if (gPref.prefHasUserValue(PREF_DSS_SKIN_TO_SELECT))
          gPref.clearUserPref(PREF_DSS_SKIN_TO_SELECT);
        clearRestartMessage();
      }
      else {
        if (gPref.getBoolPref(PREF_EXTENSIONS_DSS_ENABLED)) {
          gPref.setCharPref(PREF_GENERAL_SKINS_SELECTEDSKIN, gThemeToSelect);
        }
        else {
          // Theme change will happen on next startup, this flag tells
          // the Theme Manager that it needs to show "This theme will
          // be selected after a restart" text in the selected theme
          // item.
          gPref.setBoolPref(PREF_EXTENSIONS_DSS_SWITCHPENDING, true);
          gPref.setCharPref(PREF_DSS_SKIN_TO_SELECT, gThemeToSelect);
          clearRestartMessage();
          setRestartMessage(aSelectedItem);
        }
      }
    }

    // Flush preference change to disk
    gPref.QueryInterface(Components.interfaces.nsIPrefService)
         .savePrefFile(null);

    // disable the useThemeButton
    gExtensionsViewController.onCommandUpdate();
  };

  /**
   * Overriden method from Firefox extensions.js. Includes an additional
   * persona named "Default", used to remove all personas without removing the
   * current theme.
   */
  function rebuildLWThemeDS() {
    var rdfCU = Components.classes["@mozilla.org/rdf/container-utils;1"]
                          .getService(Components.interfaces.nsIRDFContainerUtils);
    var rootctr = rdfCU.MakeSeq(gLWThemeDS, gRDF.GetResource(RDFURI_ITEM_ROOT));
    var themes = LightweightThemeManager.usedThemes;

    // Changed from original extensions.js
    // Manually add a fake persona called "Default", which is used to remove
    // any persona and leave the current theme intact.
    let strings = gExtensionsViewController.getStrings();

    let defaultTheme = {
      "id":DEFAULT_PERSONA_ID,
      "name":strings.get("Default"),
      "accentcolor":null,
      "textcolor":null,
      "header":null,
      "footer":null,
      "category":null,
      "description":null,
      "author":null,
      "username":null,
      "detailURL":null,
      "headerURL":null,
      "footerURL":null,
      "previewURL":null,
      "iconURL":"data:image/gif;base64,R0lGODlhIwAjAJEAAKGhoaGhoaGhoaGhoSwAAAAA" +
                "IwAjAAACIZSPqcvtD6OctNqLs968+w+G4kiW5omm6sq27gvH8kzXBQA7",
      "dataurl":null
    };
    themes.unshift(defaultTheme);

    // Running in a batch stops the template builder from running
    gLWThemeDS.beginUpdateBatch();

    cleanDataSource(gLWThemeDS, rootctr);

    for (var i = 0; i < themes.length; i++) {
      var theme = themes[i];

      if (!("id" in theme))
        continue;

      var themeNode = gRDF.GetResource(PREFIX_LWTHEME_URI + theme.id);
      rootctr.AppendElement(themeNode);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "name"),
                        gRDF.GetLiteral(theme.name || ""),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "addonID"),
                        gRDF.GetLiteral(theme.id),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "isDisabled"),
                        gRDF.GetLiteral("false"),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "blocklisted"),
                        gRDF.GetLiteral("false"),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "blocklistedsoft"),
                        gRDF.GetLiteral("false"),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "compatible"),
                        gRDF.GetLiteral("true"),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "lwtheme"),
                        gRDF.GetLiteral("true"),
                        true);
      gLWThemeDS.Assert(themeNode,
                        gRDF.GetResource(PREFIX_NS_EM + "type"),
                        gRDF.GetIntLiteral(nsIUpdateItem.TYPE_THEME),
                        true);
      if (theme.author) {
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "description"),
                          gRDF.GetLiteral(getExtensionString("lightweightThemeDescription",
                                                             [theme.author])),
                          true);
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "creator"),
                          gRDF.GetLiteral(theme.author),
                          true);
      }
      if (theme.description) {
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "lwdescription"),
                          gRDF.GetLiteral(theme.description),
                          true);
      }
      if (theme.homepageURL) {
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "homepageURL"),
                          gRDF.GetLiteral(theme.homepageURL),
                          true);
      }
      if (theme.previewURL) {
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "previewImage"),
                          gRDF.GetLiteral(theme.previewURL),
                          true);
      }
      if (theme.iconURL) {
        gLWThemeDS.Assert(themeNode,
                          gRDF.GetResource(PREFIX_NS_EM + "iconURL"),
                          gRDF.GetLiteral(theme.iconURL),
                          true);
      }
    }

    gLWThemeDS.endUpdateBatch();
  }

  /**
   * Overriden method from Firefox extensions.js. Adjusts the code to allow for
   * a new view in the Addons window, separating themes from personas.
   */
  function showView(aView) {
    if (gView == aView)
      return;

    updateLastSelected(aView);
    gView = aView;

    // Using disabled to represent add-on state in regards to the EM causes evil
    // focus behavior when used as an element attribute when the element isn't
    // really disabled.
    var bindingList = [ [ ["aboutURL", "?aboutURL"],
                          ["addonID", "?addonID"],
                          ["availableUpdateURL", "?availableUpdateURL"],
                          ["availableUpdateVersion", "?availableUpdateVersion"],
                          ["blocklisted", "?blocklisted"],
                          ["blocklistedsoft", "?blocklistedsoft"],
                          ["outdated", "?outdated"],
                          ["compatible", "?compatible"],
                          ["description", "?description"],
                          ["downloadURL", "?downloadURL"],
                          ["isDisabled", "?isDisabled"],
                          ["homepageURL", "?homepageURL"],
                          ["iconURL", "?iconURL"],
                          ["internalName", "?internalName"],
                          ["locked", "?locked"],
                          ["lwtheme", "?lwtheme"],
                          ["name", "?name"],
                          ["optionsURL", "?optionsURL"],
                          ["opType", "?opType"],
                          ["plugin", "?plugin"],
                          ["previewImage", "?previewImage"],
                          ["satisfiesDependencies", "?satisfiesDependencies"],
                          ["providesUpdatesSecurely", "?providesUpdatesSecurely"],
                          ["type", "?type"],
                          ["updateable", "?updateable"],
                          ["updateURL", "?updateURL"],
                          ["version", "?version"] ] ];
    var displays = [ "richlistitem" ];
    var direction = "ascending";

    var prefURL;
    var showInstallFile = true;
    try {
      showInstallFile = !gPref.getBoolPref(PREF_EXTENSIONS_HIDE_INSTALL_BTN);
    }
    catch (e) { }
    var showCheckUpdatesAll = true;
    var showInstallUpdatesAll = false;
    var showSkip = false;
    switch (aView) {
      case "search":
        var bindingList = [ [ ["action", "?action"],
                              ["addonID", "?addonID"],
                              ["description", "?description"],
                              ["eula", "?eula"],
                              ["homepageURL", "?homepageURL"],
                              ["iconURL", "?iconURL"],
                              ["name", "?name"],
                              ["previewImage", "?previewImage"],
                              ["rating", "?rating"],
                              ["addonType", "?addonType"],
                              ["thumbnailURL", "?thumbnailURL"],
                              ["version", "?version"],
                              ["xpiHash", "?xpiHash"],
                              ["xpiURL", "?xpiURL"],
                              ["typeName", "searchResult"] ],
                          [ ["type", "?type"],
                              ["typeName", "status"],
                              ["count", "?count"],
                              ["link", "?link" ] ] ];
        var types = [ [ ["searchResult", "true", null] ],
                      [ ["statusMessage", "true", null] ] ];
        var displays = [ "richlistitem", "vbox" ];
        direction = "natural";
        showCheckUpdatesAll = false;
        document.getElementById("searchfield").disabled = isOffline("offlineSearchMsg");
        break;
      case "extensions":
        prefURL = PREF_EXTENSIONS_GETMOREEXTENSIONSURL;
        types = [ [ ["type", nsIUpdateItem.TYPE_EXTENSION, "Integer"] ] ];
        break;

      // Changed from original extensions.js
      // Separating themes from personas using the internalName and lwtheme
      // attributes, respectively.
      case "themes":
        prefURL = PREF_EXTENSIONS_GETMORETHEMESURL;
        types = [ [ ["type", nsIUpdateItem.TYPE_THEME, "Integer"],
                    ["internalName", "?internalName", null] ] ];
        break;
      case "personas":
        prefURL = null;
        types = [ [ ["type", nsIUpdateItem.TYPE_THEME, "Integer"],
                    ["lwtheme", "true", null] ] ];
        break;

      case "locales":
        types = [ [ ["type", nsIUpdateItem.TYPE_LOCALE, "Integer"] ] ];
        break;
      case "plugins":
        prefURL = PREF_EXTENSIONS_GETMOREPLUGINSURL;
        types = [ [ ["plugin", "true", null] ] ];
        if (!gPluginUpdateUrl)
          showCheckUpdatesAll = false;
        break;
      case "updates":
        document.getElementById("updates-view").hidden = false;
        showInstallFile = false;
        showCheckUpdatesAll = false;
        showInstallUpdatesAll = true;
        if (gUpdatesOnly)
          showSkip = true;
        bindingList = [ [ ["aboutURL", "?aboutURL"],
                          ["availableUpdateURL", "?availableUpdateURL"],
                          ["availableUpdateVersion", "?availableUpdateVersion"],
                          ["availableUpdateInfo", "?availableUpdateInfo"],
                          ["blocklisted", "?blocklisted"],
                          ["blocklistedsoft", "?blocklistedsoft"],
                          ["homepageURL", "?homepageURL"],
                          ["iconURL", "?iconURL"],
                          ["internalName", "?internalName"],
                          ["locked", "?locked"],
                          ["name", "?name"],
                          ["opType", "?opType"],
                          ["previewImage", "?previewImage"],
                          ["satisfiesDependencies", "?satisfiesDependencies"],
                          ["providesUpdatesSecurely", "?providesUpdatesSecurely"],
                          ["type", "?type"],
                          ["updateURL", "?updateURL"],
                          ["version", "?version"],
                          ["typeName", "update"] ] ];
        types = [ [ ["availableUpdateVersion", "?availableUpdateVersion", null],
                    ["updateable", "true", null] ] ];
        break;
      case "installs":
        document.getElementById("installs-view").hidden = false;
        showInstallFile = false;
        showCheckUpdatesAll = false;
        showInstallUpdatesAll = false;
        bindingList = [ [ ["aboutURL", "?aboutURL"],
                          ["addonID", "?addonID"],
                          ["availableUpdateURL", "?availableUpdateURL"],
                          ["availableUpdateVersion", "?availableUpdateVersion"],
                          ["blocklisted", "?blocklisted"],
                          ["blocklistedsoft", "?blocklistedsoft"],
                          ["compatible", "?compatible"],
                          ["description", "?description"],
                          ["downloadURL", "?downloadURL"],
                          ["incompatibleUpdate", "?incompatibleUpdate"],
                          ["isDisabled", "?isDisabled"],
                          ["homepageURL", "?homepageURL"],
                          ["iconURL", "?iconURL"],
                          ["internalName", "?internalName"],
                          ["locked", "?locked"],
                          ["name", "?name"],
                          ["optionsURL", "?optionsURL"],
                          ["opType", "?opType"],
                          ["previewImage", "?previewImage"],
                          ["progress", "?progress"],
                          ["state", "?state"],
                          ["type", "?type"],
                          ["updateable", "?updateable"],
                          ["updateURL", "?updateURL"],
                          ["version", "?version"],
                          ["newVersion", "?newVersion"],
                          ["typeName", "install"] ] ];
        types = [ [ ["state", "?state", null] ] ];
        break;
    }

    var showGetMore = false;
    var getMore = document.getElementById("getMore");
    if (prefURL && gPref.getPrefType(prefURL) != nsIPrefBranch2.PREF_INVALID) {
      try {
        getMore.setAttribute("value", getMore.getAttribute("value" + aView));
        var getMoreURL = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                                   .getService(Components.interfaces.nsIURLFormatter)
                                   .formatURLPref(prefURL);
        getMore.setAttribute("getMoreURL", getMoreURL);
        showGetMore = getMoreURL == "about:blank" ? false : true;
      }
      catch (e) { }
    }
    getMore.hidden = !showGetMore;

    // Changed from original extensions.js
    // Include the personas view in the isThemes flag, in order to show
    // the preview area.
    var isThemes = (aView == "themes" || aView == "personas");

    // Changed from original extensions.js
    // Include the personas view in the following block to set the correct
    // tooltip attribute.
    if (aView == "themes" || aView == "personas" ||
        aView == "extensions" || aView == "plugins") {
      var tooltipAttr = "";
      if (aView == "extensions")
        tooltipAttr = "tooltiptextaddons";
      else if (aView == "personas")
        tooltipAttr = "tooltiptextthemes";
      else
        tooltipAttr = "tooltiptext" + aView;

      var el = document.getElementById("checkUpdatesAllButton");
      el.setAttribute("tooltiptext", el.getAttribute(tooltipAttr));
      if (aView != "plugins") {
        el = document.getElementById("installFileButton");
        el.setAttribute("tooltiptext", el.getAttribute(tooltipAttr));
      }
    }

    document.getElementById("installFileButton").hidden = !showInstallFile;
    document.getElementById("checkUpdatesAllButton").hidden = !showCheckUpdatesAll;
    document.getElementById("installUpdatesAllButton").hidden = !showInstallUpdatesAll;
    document.getElementById("skipDialogButton").hidden = !showSkip;
    document.getElementById("themePreviewArea").hidden = !isThemes;
    document.getElementById("themeSplitter").hidden = !isThemes;
    document.getElementById("showUpdateInfoButton").hidden = aView != "updates";
    document.getElementById("hideUpdateInfoButton").hidden = true;
    document.getElementById("searchPanel").hidden = aView != "search";

    gExtensionsView.setAttribute("sortDirection", direction);
    AddonsViewBuilder.updateView(types, displays, bindingList, null);

    if (aView == "updates" || aView == "installs")
      gExtensionsView.selectedItem = gExtensionsView.children[0];
    else if (isThemes)
      gExtensionsView.selectedItem = getActivedThemeItem();

    if (showSkip) {
      var button = document.getElementById("installUpdatesAllButton");
      button.setAttribute("default", "true");
      window.setTimeout(function () { button.focus(); }, 0);
    } else
      document.getElementById("installUpdatesAllButton").removeAttribute("default");

    if (isThemes)
      onAddonSelect();
    updateGlobalCommands();
  }

  /**
   * Overriden method from Firefox extensions.js. Allows the double-click to
   * work for personas.
   */
  function onViewDoubleClick(aEvent) {
    if (aEvent.button != 0 || !gExtensionsView.selectedItem)
      return;

    switch (gView) {
      case "extensions":
        gExtensionsViewController.doCommand('cmd_options');
        break;
      // Changed from original extensions.js
      // Include the personas view in the double-click command.
      case "themes":
      case "personas":
        gExtensionsViewController.doCommand('cmd_useTheme');
        break;
      case "updates":
        gExtensionsViewController.doCommand('cmd_includeUpdate');
        break;
    }
  }

  // Changed from original extensions.js
  // Adds a new item to the add-ons context menu, "Use Persona".
  gAddonContextMenus.unshift("menuitem_usePersona");

  /**
   * Overriden method from Firefox extensions.js. Prepares the context menu for
   * persona items.
   */
  function buildContextMenu(aEvent) {
    var popup = document.getElementById("addonContextMenu");
    var selectedItem = gExtensionsView.selectedItem;
    if (aEvent.target !== popup || !selectedItem)
      return false;

    while (popup.hasChildNodes())
      popup.removeChild(popup.firstChild);

    switch (gView) {
    case "search":
      var menus = gSearchContextMenus;
      break;

    // Changed from original extensions.js
    // Include the "personas" view in the switch, to set the add-ons context menu.
    case "extensions":
    case "themes":
    case "personas":
    case "locales":
    case "plugins":
      menus = gAddonContextMenus;
      break;

    case "updates":
      menus = gUpdateContextMenus;
      break;
    case "installs":
      menus = gInstallContextMenus;
      break;
    }

    for (var i = 0; i < menus.length; ++i) {
      var clonedMenu = document.getElementById(menus[i]).cloneNode(true);
      clonedMenu.id = clonedMenu.id + "_clone";
      popup.appendChild(clonedMenu);
    }

    // All views (but search and plugins) support about
    if (gView != "search" && gView != "plugins") {
      var menuitem_about = document.getElementById("menuitem_about_clone");
      var name = selectedItem ? selectedItem.getAttribute("name") : "";
      menuitem_about.setAttribute("label", getExtensionString("aboutAddon", [name]));
    }

    // Make sure all commands are up to date
    gExtensionsViewController.onCommandUpdate();

    // Some flags needed later
    var canCancelInstall = gExtensionsViewController.isCommandEnabled("cmd_cancelInstall");
    var canCancelUpgrade = gExtensionsViewController.isCommandEnabled("cmd_cancelUpgrade");
    var canReallyEnable = gExtensionsViewController.isCommandEnabled("cmd_reallyEnable");
    var canCancelUninstall = gExtensionsViewController.isCommandEnabled("cmd_cancelUninstall");

    /* When an update or install is pending allow canceling the update or install
       and don't allow uninstall. When an uninstall is pending allow canceling the
       uninstall.*/
    if (gView != "updates") {
      document.getElementById("menuitem_cancelInstall_clone").hidden = !canCancelInstall;

      if (gView != "installs" && gView != "search") {
        document.getElementById("menuitem_cancelUninstall_clone").hidden = !canCancelUninstall;
        document.getElementById("menuitem_uninstall_clone").hidden = canCancelUninstall ||
                                                                     canCancelInstall ||
                                                                     canCancelUpgrade;
      }

      if (gView != "search")
        document.getElementById("menuitem_cancelUpgrade_clone").hidden = !canCancelUpgrade;
    }

    // Changed from original extensions.js
    // Manipulation of the new "Use Persona" menu item, shown only for personas.
    switch (gView) {
    case "extensions":
      document.getElementById("menuitem_enable_clone").hidden = !canReallyEnable;
      document.getElementById("menuitem_disable_clone").hidden = canReallyEnable;
      document.getElementById("menuitem_useTheme_clone").hidden = true;
      document.getElementById("menuitem_usePersona_clone").hidden = true;
      break;
    case "personas":
    case "themes":
      var enableMenu = document.getElementById("menuitem_enable_clone");
      if (!selectedItem.isCompatible || selectedItem.isBlocklisted ||
          !selectedItem.satisfiesDependencies || selectedItem.isDisabled)
        // don't let the user activate incompatible themes, but show a (disabled) Enable
        // menuitem to give visual feedback; it's disabled because cmd_enable returns false
        enableMenu.hidden = false;
      else
        enableMenu.hidden = true;
      document.getElementById("menuitem_options_clone").hidden = true;
      document.getElementById("menuitem_disable_clone").hidden = true;
      document.getElementById("menuitem_useTheme_clone").hidden = gView != "themes";
      document.getElementById("menuitem_usePersona_clone").hidden = gView != "personas";
      break;
    case "plugins":
      document.getElementById("menuitem_about_clone").hidden = true;
      document.getElementById("menuitem_uninstall_clone").hidden = true;
      document.getElementById("menuitem_checkUpdate_clone").hidden = true;
    case "locales":
      document.getElementById("menuitem_enable_clone").hidden = !canReallyEnable;
      document.getElementById("menuitem_disable_clone").hidden = canReallyEnable;
      document.getElementById("menuitem_useTheme_clone").hidden = true;
      document.getElementById("menuitem_usePersona_clone").hidden = true;
      document.getElementById("menuitem_options_clone").hidden = true;
      break;
    case "updates":
      var includeUpdate = document.getAnonymousElementByAttribute(selectedItem, "anonid", "includeUpdate");
      var menuitem_includeUpdate = document.getElementById("menuitem_includeUpdate_clone");
      menuitem_includeUpdate.setAttribute("checked", includeUpdate.checked ? "true" : "false");
      break;
    case "installs":
      // Hides the separator if nothing is below it
      document.getElementById("menuseparator_1_clone").hidden = !canCancelInstall && !canCancelUpgrade;
      break;
    case "search":
      var canInstall = gExtensionsViewController.isCommandEnabled("cmd_installSearchResult");
      document.getElementById("menuitem_installSearchResult_clone").hidden = !canInstall;
      // Hides the separator if nothing is below it
      document.getElementById("menuseparator_1_clone").hidden = !canCancelInstall;
      break;
    }

    return true;
  }

  /**
   * Overriden method from Firefox extensions.js. Allows personas to be
   * previewed in the Addons window.
   */
  function onAddonSelect(aEvent) {
    var viewButton = document.getElementById("viewGroup").selectedItem;
    if (viewButton.hasAttribute("persist") && gExtensionsView.selectedItem)
      viewButton.setAttribute("last-selected", gExtensionsView.selectedItem.id);

    if (!document.getElementById("themePreviewArea").hidden) {
      var previewImageDeck = document.getElementById("previewImageDeck");

      // Changed from original extensions.js
      // Include the "Personas" view to show the preview image.
      if (gView == "themes" || gView == "personas") {
        var previewImage = document.getElementById("previewImage");
        if (!gExtensionsView.selectedItem) {
          previewImageDeck.selectedIndex = 0;
          if (previewImage.hasAttribute("src"))
            previewImage.removeAttribute("src");
        }
        else {
          var url = gExtensionsView.selectedItem.getAttribute("previewImage");
          if (url) {
            previewImageDeck.selectedIndex = 2;
            previewImage.setAttribute("src", url);
          }
          else {
            previewImageDeck.selectedIndex = 1;
            if (previewImage.hasAttribute("src"))
              previewImage.removeAttribute("src");
          }
        }
      }
      else if (gView == "updates") {
        UpdateInfoLoader.cancelLoad();
        if (!gExtensionsView.selectedItem) {
          previewImageDeck.selectedIndex = 3;
        }
        else {
          var uri = gExtensionsView.selectedItem.getAttribute("availableUpdateInfo");
          if (isSafeURI(uri))
            UpdateInfoLoader.loadInfo(uri);
          else
            previewImageDeck.selectedIndex = 4;
        }
      }
    }
  }

  /**
   * Initializes the Personas icon image in the Extension Manager. The icon is
   * set only if the other tabs are also showing an image.
   */
  function initPersonasIcon() {
    let radio = document.getElementById("personas-view");
    radio.removeAttribute("hidden");
    let style = window.getComputedStyle(radio, null);

    // Set the personas icon ONLY if the other buttons have an icon set.
    if (style.listStyleImage != "none")
      radio.style.listStyleImage = 'url("chrome://personas/content/personas_32x32.png")';
  }

  window.addEventListener("load", initPersonasIcon, false);
}
