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

getAMOFeatured();
getAMOFavorites();

document.querySelector("#signInLink").addEventListener("click", (event) => {
    browser.runtime.sendMessage({
        "action": "openAMOAndMonitor",
    });
    event.preventDefault();
    window.close();
});

document.querySelector("#openCustomPage").addEventListener("click", (event) => {
    browser.tabs.create({
        url: "../custom/custom.html"
    });
    event.preventDefault();
});

document.querySelector("#resetPersona").addEventListener("click", (event) => {
    reset();
    event.preventDefault();
});

function getAMOFeatured() {
    //document.querySelector("#featured-header").textContent = "Featured themes (loading...)";

    browser.runtime.onMessage.addListener((message) => {
        if (message.featured) {
            let container = document.querySelector("#featured");
            addAMOPersonas(message.featured, container);
            //document.querySelector("#featured-header").textContent = "Featured themes";
        }
    });
    browser.runtime.sendMessage({"action": "getFeatured"});
}

function getAMOFavorites() {
    //document.querySelector("#favorites-header").textContent = "Favorite themes (loading...)";

    browser.runtime.onMessage.addListener((message) => {
        if (message.favorites) {
            if (message.favorites.error && (message.favorites.error === "NotLoggedIn")) {
                document.querySelector("#signInNote").style.display = "block";
            } else {
                let container = document.querySelector("#favorites");
                addAMOPersonas(message.favorites, container);
            }
            //document.querySelector("#favorites-header").textContent = "Favorite themes";
        }
    });
    browser.runtime.sendMessage({"action": "getFavorites"});

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
