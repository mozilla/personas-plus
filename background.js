async function restorePersona() {
    let storageResult = await browser.storage.local.get("currentPersona");

    if (storageResult && storageResult.currentPersona) {
        browser.theme.update(storageResult.currentPersona);
    }
}

restorePersona();

browser.management.onEnabled.addListener((addon) => {
    if (addon.type === "theme") {
        browser.storage.local.remove("currentPersona");
    }
});