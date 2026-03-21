let order = document.querySelector(".order");
let slide = document.querySelector(".slide");
order.addEventListener("click", () => {
    if (slide.style.right == "6%") {
        slide.style.right = "-40%"
    }
    else {
        slide.style.right = "6%"
    }
})
