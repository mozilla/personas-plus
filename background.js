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

browser.runtime.onMessage.addListener((message) => {
    if (message.name === "monitorTabForCookie") {
        console.log(`Got tab ${message.tabId} from popup.`);
        browser.cookies.onChanged.addListener((changeInfo) => {
            if (changeInfo.cookie.domain === "addons.mozilla.org" && changeInfo.cookie.name === "api_auth_token" && !changeInfo.removed && changeInfo.cause === "explicit") {
                browser.tabs.remove(parseInt(message.tabId));
            }
        });
    }
});
