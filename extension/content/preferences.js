const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

let PersonasPreferences = {
  onSelectCustom: function(event) {
    window.close();
    opener.window.openUILinkIn("chrome://personas/content/customPersonaEditor.xul", "tab");
  },
  onAccept: function(event) {
  }
};
