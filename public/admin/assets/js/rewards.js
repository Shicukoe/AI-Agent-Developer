'use strict'
$(window).on('load', function () {
    /* Swiper slider */
    var swiper = new Swiper(".productswiper", {
        slidesPerView: "auto",
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        loop: true,
    });
});