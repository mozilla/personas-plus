document.querySelector('#form-submit').addEventListener('click', (event) => {
    let backgroundColor = document.querySelector('#accent-color').value;
    let textColor = document.querySelector('#text-color').value;

    let header = document.querySelector('#header-image');
    let file = header.files[0];
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        browser.theme.update({
            images: {
                headerURL: "dummy.jpg", //reader.result,
            },
            colors: {
                accentcolor: backgroundColor,
                textcolor: textColor
            }
        });
    });

    if (file) {
        reader.readAsDataURL(file);
    }
    else {
        alert("Y U NO select a file?!")
    }
});


document.querySelector('#form-reset').addEventListener('click', (event) => {
    browser.theme.reset();
});