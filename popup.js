function reset() {
    browser.theme.reset();
}

async function getInstalled() {
    let addons = await browser.management.getAll();
    const parent = document.getElementById("installed");

    for (let addon of addons) {
        if (addon.type == "theme") {
            const entry = document.createElement("li");
            entry.appendChild(document.createTextNode(addon.name));
            entry.addEventListener("click", function() {
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

async function getAMOCookie() {
    let amoCookie = await browser.cookies.get({
        url: "https://addons.mozilla.org",
        name: "api_auth_token"
    });
    if (amoCookie) {
        return amoCookie;
    } else {
        browser.tabs.create({
            url: "https://addons.mozilla.org/firefox/users/login"
        });
        alert("You need to log in into AMO to access your favorites. A new tab will open that allows you to do so now.");
    }
}

document.querySelector("#featured-header").addEventListener("click", () => {
    getAMOFeatured();
});

document.querySelector("#favorites-header").addEventListener("click", async() => {
    let profile = await getAMOProfile();
    if (profile) {
        let username = profile.username;
        getAMOFavorites(username);
    }
});

document.querySelector("#resetPersona").addEventListener("click", () => {
    reset();
});

async function makeAMORequest(url, auth) {
    let options = {};
    if (auth) {
        let cookie = await getAMOCookie();
        if (!cookie) {
            return;
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

async function getAMOProfile() {
    let account = await makeAMORequest("https://addons.mozilla.org/api/v3/accounts/profile/", true);
    return account;
}

async function getAMOFeatured() {
    let result = await makeAMORequestPaginated("https://addons.mozilla.org/api/v3/accounts/account/mozilla/collections/featured-personas/addons/?sort=added");
    let container = document.querySelector("#featured");
    for (let entry of result) {
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
            div.addEventListener("click", function() {
                enablePersona(persona);
            });
            container.appendChild(div);
        }
    }
}

async function getAMOFavorites(username) {
    let result = await makeAMORequestPaginated(`https://addons.mozilla.org/api/v3/accounts/account/${username}/collections/favorites/addons/`, true);
    let container = document.querySelector("#favorites");
    for (let entry of result) {
        if (entry.addon.type === "persona") {
            let persona = entry.addon;
            let div = document.createElement("li");
            let nameSpan = document.createTextNode(persona.name[persona.default_locale]);
            let image = document.createElement("img");
            image.setAttribute("src", persona.theme_data.previewURL);
            image.addEventListener("click", function() {
                enablePersona(persona);
            });
            let imageDiv = document.createElement("div");
            imageDiv.appendChild(image);
            div.appendChild(nameSpan);
            div.appendChild(imageDiv);
            container.appendChild(div);
        }
    }
}