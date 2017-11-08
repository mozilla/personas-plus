document.querySelector("#form-submit").addEventListener("click", () => {
    let backgroundColor = document.querySelector("#accent-color").value;
    let textColor = document.querySelector("#text-color").value;

    let header = document.querySelector("#header-image");
    let file = header.files[0];
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        let data = {
            images: {
                headerURL: reader.result,
            },
            colors: {
                accentcolor: backgroundColor,
                textcolor: textColor
            }
        };
        browser.theme.update(data);
        browser.storage.local.set({"currentPersona": data});
    });

    if (file) {
        reader.readAsDataURL(file);
    }
    else {
        alert("Y U NO select a file?!");
    }
});

document.querySelector("#header-image").addEventListener("change", (event) => {
    if (event.target.files[0]) {
        document.querySelector("#form-submit").disabled = false;
    }
});
