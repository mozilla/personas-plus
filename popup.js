async function getInstalled() {
    let addons = await browser.management.getAll();
    const parent = document.getElementById("installed");

    for (let addon of addons) {
        if (addon.type == "theme") {
            const entry = document.createElement("li");
            entry.appendChild(document.createTextNode(addon.name));
            entry.addEventListener("click", function(event) {
                browser.management.setEnabled(addon.id, true);
            });
            parent.appendChild(entry);
        }
    }

}

getInstalled();

async function getAMOCookie() {
    let amoCookie = await browser.cookies.get({
        url: 'https://addons.mozilla.org',
        name: 'api_auth_token'
    });
    if (amoCookie) {
        return amoCookie;
    } else {
        alert("You need to log in into AMO to access your favorites. A new tab will open that allows you to do so now.");
        // browser.tabs.create(...) //TODO
    }
}

document.querySelector("#featured-header").addEventListener("click", () => {
    getAMOFeatured();
});

document.querySelector("#favorites-header").addEventListener("click", () => {
    //let profile = await getAMOProfile();
});

async function makeAMORequest(path) {
    let result = [];
    let url = `https://addons.mozilla.org/api/v3/${path}`;
    await makeAMORequestPaginated(url, result);
    return result;
}

async function makeAMORequestPaginated(next, results) {
    //let cookie = await getAMOCookie();
    var headers = new Headers();
    //headers.set("Authorization", "Bearer " + cookie.value.replace(/"/g, ''));
    let options = {
        headers: headers
    }
    let response = await fetch(next, options);
    let obj = await response.json();
    for (let entry of obj.results) {
        if (entry.addon.type === "persona") {
            results.push(entry.addon);
        }
    }
    if (obj.next) {
        await makeAMORequestPaginated(obj.next, results);
    }
    return results;

}

function getAMOProfile(cookie) {
    makeAMORequest()
}

async function getAMOFeatured() {
    let result = await makeAMORequest('accounts/account/mozilla/collections/featured-personas/addons/');
    let container = document.querySelector('#featured');
    for (let entry of result) {
        let div = document.createElement('li');
        let nameSpan = document.createTextNode(entry.name[entry.default_locale]);
        div.appendChild(nameSpan);
        container.appendChild(div);
    }
}
