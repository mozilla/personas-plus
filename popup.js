async function getInstalled() {
    let addons = await browser.management.getAll();
    const parent = document.getElementById("installed");

    for (let addon of addons) {
        if (addon.type == "theme") {
            const entry = document.createElement("li");
            entry.style.fontSize = "16px";
            entry.appendChild(document.createTextNode(addon.name));
            entry.addEventListener("click", () => {
                // We need this hack because we use .update even for AMO themes.
                browser.theme.reset();
                browser.management.setEnabled(addon.id, false);
                browser.management.setEnabled(addon.id, true);
            });
            parent.appendChild(entry);
        }
    }
}
getInstalled();

async function enablePersona(persona) {
    let response = await fetch(persona.theme_data.headerURL);
    let blob = await response.blob();

    var reader = new FileReader();
    reader.addEventListener("load", () => {
        let data = {
            images: {
                headerURL: reader.result,
            },
            colors: {
                accentcolor: persona.theme_data.accentcolor,
                textcolor: persona.theme_data.textcolor
            }
        };
        browser.theme.update(data);
        browser.storage.local.set({
            "currentPersona": data
        });
    });
    reader.readAsDataURL(blob);
}

function reset() {
    browser.theme.reset();
}

async function getAMOCookie() {
    let amoCookie = await browser.cookies.get({
        url: "https://addons.mozilla.org",
        name: "api_auth_token"
    });
    return amoCookie;
}

getAMOFeatured();

async function getFavorites() {
    try {
        await getAMOFavorites();
    } catch (error) {
        if (error === "NotLoggedIn") {
            document.querySelector("#signInNote").style.display = "block";
        }
    }
}
getFavorites();

document.querySelector("#signInLink").addEventListener("click", async() => {
    let tab = await browser.tabs.create({
        url: "https://addons.mozilla.org/firefox/users/login"
    });
    browser.runtime.sendMessage({
        "name": "monitorTabForCookie",
        "tabId": tab.id
    });
    console.log(`Sending tab ${tab.id} to background script.`);
    window.close();
});

document.querySelector("#openCustomPage").addEventListener("click", () => {
    browser.tabs.create({
        url: "custom.html"
    });
});

document.querySelector("#resetPersona").addEventListener("click", () => {
    reset();
});

async function makeAMORequest(url, auth) {
    let options = {};
    if (auth) {
        let cookie = await getAMOCookie();
        if (!cookie) {
            throw "NotLoggedIn";
        }
        let headers = new Headers();
        headers.set("Authorization", "Bearer " + cookie.value.replace(/"/g, ""));
        options.headers = headers;
    }

    let response = await fetch(url, options);
    let obj = await response.json();
    return obj;
}

async function makeAMORequestPaginated(url, auth, results = []) {
    let result = await makeAMORequest(url, auth);
    results.push(...result.results);
    if (result.next) {
        await makeAMORequestPaginated(result.next, auth, results);
    }
    return results;
}

async function getAMOFeatured() {
    document.querySelector("#featured-header").textContent = "Featured themes (loading...)";
    let result = await makeAMORequestPaginated("https://addons.mozilla.org/api/v3/accounts/account/mozilla/collections/featured-personas/addons/?sort=added");
    let container = document.querySelector("#featured");
    addAMOPersonas(result, container);
    document.querySelector("#featured-header").textContent = "Featured themes";
}

async function getAMOFavorites() {
    let profile = await makeAMORequest("https://addons.mozilla.org/api/v3/accounts/profile/", true);
    if (profile) {
        document.querySelector("#favorites-header").textContent = "Favorite themes (loading...)";
        let result = await makeAMORequestPaginated(`https://addons.mozilla.org/api/v3/accounts/account/${profile.username}/collections/favorites/addons/`, true);
        let container = document.querySelector("#favorites");
        addAMOPersonas(result, container);
    }
    document.querySelector("#favorites-header").textContent = "Favorite themes";
}

function addAMOPersonas(personas, container) {
    for (let entry of personas) {
        if (entry.addon.type === "persona") {
            let persona = entry.addon;
            let div = document.createElement("li");
            div.style.marginBottom = "2em";
            let nameSpan = document.createElement("span");
            nameSpan.appendChild(document.createTextNode(persona.name[persona.default_locale]));
            nameSpan.style.fontSize = "16px";
            let image = document.createElement("img");
            image.setAttribute("src", persona.theme_data.previewURL);
            let imageDiv = document.createElement("div");
            imageDiv.appendChild(image);
            div.appendChild(nameSpan);
            div.appendChild(imageDiv);
            div.addEventListener("click", () => {
                enablePersona(persona);
            });
            container.appendChild(div);
        }
    }
}
