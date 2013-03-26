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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Myk Melez <myk@mozilla.org>
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

// modules that are generic
Cu.import("resource://personas/modules/Preferences.js");
Cu.import("resource://personas/modules/StringBundle.js");

// modules that are Personas-specific
Cu.import("resource://personas/modules/service.js");


let CustomPersonaEditor = {
  //**************************************************************************//
  // Shortcuts

  get _prefs() {
    delete this._prefs;
    return this._prefs = new Preferences("extensions.personas.");
  },

  get _strings() {
    delete this._strings;
    return this._strings = new StringBundle("chrome://personas/locale/personas.properties");
  },

  get _customName() {
    let customName = document.getElementById("customName");
    delete this._customName;
    this._customName = customName;
    return this._customName;
  },

  get _header() {
    let header = document.getElementById("headerURL");
    delete this._header;
    this._header = header;
    return this._header;
  },

  get _footer() {
    let footer = document.getElementById("footerURL");
    delete this._footer;
    this._footer = footer;
    return this._footer;
  },

  get _textColorPicker() {
    let textColorPicker = document.getElementById("textColorPicker");
    delete this._textColorPicker;
    this._textColorPicker = textColorPicker;
    return this._textColorPicker;
  },

  get _accentColorPicker() {
    let accentColorPicker = document.getElementById("accentColorPicker");
    delete this._accentColorPicker;
    this._accentColorPicker = accentColorPicker;
    return this._accentColorPicker;
  },

  get _blankImage() {
    return "data:image/gif;base64,R0lGODlhAQABAJH/AP///wAAAMDAwAAAACH5BAEAAAIALAAAAAABAAEAAAICVAEAOw=="
  },

  customPersona: null,


  //**************************************************************************//
  // Initialization & Destruction

  onLoad: function() {
    this._restore();
  },

  onUnload: function() {
    PersonaService.resetPersona();
  },


  //**************************************************************************//
  // XPCOM Interfaces

  // nsIObserver

  observe: function(aSubject, aTopic, aData) {
    switch(aTopic) {
      case "nsPref:changed":
        switch (aData) {
          case "custom":
            this._restore();
            break;
        }
        break;
    }
  },


  //**************************************************************************//
  // Implementation

  _save: function() {
    this._prefs.set("custom", JSON.stringify(this.customPersona));
    PersonaService.previewPersona(this.customPersona);
  },

  _restore: function() {
    try {
      this.customPersona = JSON.parse(this._prefs.get("custom"));
      this.customPersona.custom = true;
    }
    catch(ex) {
      this.customPersona = {
        id: "1",
        name: this._strings.get("customPersona"),
        headerURL: this._blankImage,
        footerURL: this._blankImage,
        custom: true };
    }

    this._header.value = this.customPersona.headerURL || this.customPersona.header || "";
    this._footer.value = this.customPersona.footerURL || this.customPersona.footer || "";
    this._customName.value = this.customPersona.name || "";
    this._textColorPicker.color = this.customPersona.textcolor || "#000000";
    this._accentColorPicker.color = this.customPersona.accentcolor || "#C9C9C9";

    // FIXME: This is a workaround for bug 532741, where the LightweightThemeManager
    // needs a header and footer to be specified in order to preview the persona.
    // Remove the blank image info from the textboxes
    if (this._header.value == this._blankImage)
      this._header.value = "";
    if (this._footer.value == this._blankImage)
      this._footer.value = "";

    PersonaService.previewPersona(this.customPersona);
  },

  onChangeName: function(aEvent) {
    let control = aEvent.target;
    // Trim leading and trailing whitespace.
    let value = control.value.replace(/^\s*|\s*$/g, "");
    this.customPersona.name = value || this._strings.get("customPersona");
    this._save();
  },

  // Apply header and footer control changes to the prefs.
  onChangeBackground: function(event) {
    let control = event.target;
    let property = control.id;

    // Trim leading and trailing whitespace.
    let value = control.value.replace(/^\s*|\s*$/g, "");

    if (value == "")
      this.customPersona[property] = this._blankImage;
    else
      this.customPersona[property] = value;

    this._save();
  },

  onSelectBackground: function(event) {
    let button = event.target;
    let control = button.previousSibling;
    let property = control.id;

    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window,
            this._strings.get("backgroundPickerDialogTitle"),
            Ci.nsIFilePicker.modeOpen);
    let result = fp.show();

    if (result == Ci.nsIFilePicker.returnOK) {
      // A random number is appended to avoid displaying a cached image
      // after the image has been modified.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=543333
      control.value = this.customPersona[property] =
        fp.fileURL.spec + "?" + Math.floor(Math.random() * 10000);
      this._save();
    }
  },

  onChangeTextColor: function(aEvent) {
    this.customPersona.textcolor = this._textColorPicker.color;
    PersonaService.resetPersona();
    this._save();
  },

  onSetDefaultTextColor: function(aEvent) {
    this._textColorPicker.color = "#000000";
    this.onChangeTextColor();
  },

  onChangeAccentColor: function(aEvent) {
    this.customPersona.accentcolor = this._accentColorPicker.color;
    PersonaService.resetPersona();
    this._save();
  },

  onSetDefaultAccentColor: function(aEvent) {
    this._accentColorPicker.color = "#C9C9C9";
    this.onChangeAccentColor();
  },

  onApply: function() {
    PersonaService.changeToPersona(this.customPersona);
    switch (PersonaService.appInfo.ID) {
      case PersonaService.THUNDERBIRD_ID:
	Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator).
        getMostRecentWindow("mail:3pane").
        document.getElementById("tabmail").
        removeCurrentTab();
        break;
      case PersonaService.FIREFOX_ID:
 	window.close();
        break;
      default:
        throw "unknown application ID " + PersonaService.appInfo.ID;
    }
  }
};
