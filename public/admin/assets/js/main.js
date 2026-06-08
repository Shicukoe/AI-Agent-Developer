'use strict'
var body = $('body');
var bodyParent = $('html');
var windowwidth = $(window).width();

$(document).ready(function () {

    /* page load as iframe */
    if (self !== top) {
        body.addClass('iframe');
    } else {
        body.removeClass('iframe');
    }

    /* menu open close */
    $('.menu-btn').on('click', function () {
        if (body.hasClass('menu-close') === true) {
            body.removeClass('menu-close');
        } else {
            body.addClass('menu-close');
        }

        return false;
    });
    /* menu close on small device */
    menuclosetablet();

    /* inner sidebar open close */
    function innermenuopen() {
        $('.innersidebar-btn').on('click', function () {
            if (body.hasClass('innermenu-close') === true) {
                body.removeClass('innermenu-close');
            } else {
                body.addClass('innermenu-close');
            }
            return false;
        });
    }
    function innermenuclose() {
        $('.inner-sidebar-content').on('click', function () {
            if (body.hasClass('innermenu-close') === true) {
                body.removeClass('innermenu-close');
            }
        });
    }
    innermenuopen();
    if (windowwidth < 1300) {
        innermenuclose();
    }

    /* full screen */
    var elem = document.documentElement;
    $('#gofullscreen').on('click', function () {
        if (body.hasClass('isfullscreen') === true) {
            body.removeClass('isfullscreen');
            $(this).attr('data-bs-original-title', 'Go Fullscreen').find('i').attr('class', 'bi bi-fullscreen');

            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }

        } else {
            body.addClass('isfullscreen');
            $(this).attr('data-bs-original-title', 'Exit Fullscreen').find('i').attr('class', 'bi bi-fullscreen-exit');

            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { /* Safari */
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { /* IE11 */
                elem.msRequestFullscreen();
            }

        }

    });

    /* rightbar */
    function rightbaropen() {
        if (body.hasClass('rightbar-open') === true) {
            body.removeClass('rightbar-open');
        } else {
            body.addClass('rightbar-open');
        }
    }

    /* chat and notification open  */
    var chatwindow = $('#chatwindow');
    var notificationwindow = $('#notificationwindow');

    $('#showChat').on('click', function () {
        if (body.hasClass('rightbar-open') != true && chatwindow.hasClass('d-none') === true) {
            body.addClass('rightbar-open');
            chatwindow.removeClass('d-none');
            notificationwindow.addClass('d-none');
        } else if (body.hasClass('rightbar-open') === true && chatwindow.hasClass('d-none') === true) {
            chatwindow.removeClass('d-none');
            notificationwindow.addClass('d-none');
        } else {
            body.removeClass('rightbar-open');
            setTimeout(function () {
                chatwindow.addClass('d-none');
            }, 500);
        }
    });

    $('#showNotification').on('click', function () {
        if (body.hasClass('rightbar-open') != true && notificationwindow.hasClass('d-none') === true) {
            body.addClass('rightbar-open');
            notificationwindow.removeClass('d-none');
            chatwindow.addClass('d-none');
        } else if (body.hasClass('rightbar-open') === true && notificationwindow.hasClass('d-none') === true) {
            notificationwindow.removeClass('d-none');
            chatwindow.addClass('d-none');
        } else {
            body.removeClass('rightbar-open');
            setTimeout(function () {
                notificationwindow.addClass('d-none');
            }, 500);
        }
    });

    /* close chat or notification on 'main' content click */
    $('.main').on("click", function (e) {
        body.removeClass('rightbar-open');
        setTimeout(function () {
            notificationwindow.addClass('d-none');
            chatwindow.addClass('d-none');
        }, 500);
    });

    /* menu style switch */
    $('#menu-pushcontent').on('change', function () {
        if ($(this).is(':checked') === true) {
            body.addClass('menu-push-content');
            body.removeClass('menu-overlay');
        }

        return false;
    });

    $('#menu-overlay').on('change', function () {
        if ($(this).is(':checked') === true) {
            body.removeClass('menu-push-content');
            body.addClass('menu-overlay');
        }

        return false;
    });


    /* back page navigation */
    $('.back-btn').on('click', function () {
        window.history.back();
        return false;
    });

    /* scroll y limited container height on page  */
    if (header.length > 0) {
        $('.mainheight').css({ 'min-height': Number(maincontentheight - header.outerHeight() - 10), 'margin-top': header.outerHeight() + 10 });

        if (sidebarwrap.length > 0) {
            sidebarwrap.css('padding-top', header.outerHeight() + 25);
        }
        if (rightbarwrap.length > 0) {
            rightbarwrap.css({ 'padding-top': header.outerHeight() + 10 });
        }
    }
    if (footer.length > 0) {
        $('.mainheight').css('min-height', Number(maincontentheight - footer.outerHeight() - 10));

        if (rightbarwrap.length > 0) {
            rightbarwrap.css({ 'padding-bottom': footer.outerHeight() });
        }
    }

    /* column set */
    /*  xs: 0,
        sm: 576px,
        md: 768px,
        lg: 992px,
        xl: 1200px,
        xxl: 1400px  */
    $('.select-column-size > div').on('click', function () {
        var columnselect = $(this);
        var columnwidth = columnselect.attr('data-title');
        var columnset = columnselect.closest('.column-set');
        $(this).closest('.dropdown-item').find('.select-column-size > div').removeClass('active');


        if (windowwidth >= 1400) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-xxl-\S+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-xxl-' + columnwidth)
        } else if (windowwidth < 1400 && windowwidth >= 1200) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-xl-\S+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-xl-' + columnwidth)
        } else if (windowwidth < 1200 && windowwidth >= 992) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-lg-\S+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-lg-' + columnwidth)
        } else if (windowwidth < 992 && windowwidth >= 768) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-md-\S+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-md-' + columnwidth)
        } else if (windowwidth < 768 && windowwidth >= 576) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-sm-\S+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-sm-' + columnwidth)
        } else if (windowwidth < 576) {
            $(columnset).removeClass(function (index, css) { return (css.match(/(^|\s)col-[0-9]+/g) || []).join(' '); });
            columnselect.addClass('active')
            columnset.addClass('col-' + columnwidth)
        }
    });


    /* PWA add to phone Install ap button */
    var btnAdd = document.getElementById('addtohome')
    var defferedPrompt;
    window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        defferedPrompt = event;

        btnAdd.addEventListener("click", function (event) {
            defferedPrompt.prompt();


            defferedPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                defferedPrompt = null;
            });
        });
    });


});

var footer = $('.footer');
var header = $('.header > .navbar');
var sidebarwrap = $('.sidebar-wrap');
var rightbarwrap = $('.rightbar-wrap');
var maincontentheight = $(window).height();

$(window).on('load', function () {
    /* loader hider */
    setTimeout(function () {
        $('.loader-wrap').hide();
    }, 100)

    coverimg();

    /* url path on menu */
    var path = window.location.href.split("/").slice(-1); // because the 'href' property of the DOM element is the absolute path
    $('.sidebar-wrap .nav li a').removeClass('active');
    $('.sidebar-wrap .sidebar .nav li a').each(function () {
        var linkitem = $(this);

        if (linkitem.attr('href') == path) {
            linkitem.addClass("active");

            if (linkitem.closest('.dropdown').length > 0) {
                linkitem.closest('.dropdown').find('.dropdown-toggle').addClass('show')
                linkitem.closest('.dropdown').find('.dropdown-menu').addClass('show')
            }
        }
    });

    /* popover executes */
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    })
    /* all tooltip execute */
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });
    /* hide tooltip after 1000ms once shown */
    document.addEventListener('shown.bs.tooltip', function (e) {
        setTimeout(function () {
            $(e.target).tooltip('hide');
        }, 500);
    })
    /* dropdown close  */
    $(".ddclose").click(function () {
        $(this).parents(".dropdown-menu").prev().dropdown("toggle");
    });


    /* prevent close dropdow on inside click */
    $('.dropdown-dontclose').on('click blur', function (event) {
        $('.dropdown-item').removeClass('show').next('.dropdown-menu').removeClass('show');
        event.stopPropagation();
        $(this).find('.dropdown-item').addClass('show').next().addClass('show');

    });


    // animate value;
    var obj = $('.increamentcount');
    var result = obj.length;
    for (var i = 0; i < result; i++) {
        animateValue(obj[i], 0, obj[i].innerHTML, 2500);
    }

    /* min height  */
    if (header.length > 0 && footer.length > 0) {
        setTimeout(function () {
            $('.mainheight').css({ 'min-height': maincontentheight - header.outerHeight() - footer.outerHeight() - 10 });
        }, 100)
    }

    /* scrolled to bottom */
    scrolledtobottom();

    /* scroll from top and add class */
    if ($(document).scrollTop() > '30') {
        $('.header').addClass('active');
    } else {
        $('.header').removeClass('active');
    }

    /* chosen title filter dd */
    if ($('.simplechosen').length > 0) {
        $('.simplechosen').chosen();
    }

});


$(window).on('scroll', function () {

    /* scroll from top and add class */
    if ($(document).scrollTop() > '30') {
        $('.header').addClass('active');
    } else {
        $('.header').removeClass('active');
    }

    /* scrolled to bottom */
    scrolledtobottom();
});


$(window).on('resize', function () {
    /* update window width for columns set on resize */
    windowwidth = $(window).width();

    /* scroll y limited container height on page  */
    var maincontentheight = $(window).height();
    if (header.length > 0) {
        maincontentheight = Number(maincontentheight - header.outerHeight()) - 10;
        $('.mainheight').css({ 'min-height': maincontentheight, 'margin-top': header.outerHeight() + 10 });

        if (sidebarwrap.length > 0) {
            sidebarwrap.css('padding-top', header.outerHeight() + 10);
        }
    }
    if (footer.length > 0) {
        maincontentheight = Number(maincontentheight - footer.outerHeight());
        $('.mainheight').css('min-height', maincontentheight);
    }

    /* menu close on small device */
    menuclosetablet();

});

/* coverimg */
function coverimg() {
    $('.coverimg').each(function () {
        var imgpath = $(this).find('img');
        $(this).css('background-image', 'url(' + imgpath.attr('src') + ')');
        imgpath.hide();
    });
}

/* create cookie */
function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";  path=/; SameSite=None; Secure";
}
function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";

}
function removeCookie(cname) {
    document.cookie = cname + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

/* menu close on small device */
function menuclosetablet() {
    if ($(window).width() <= 992) {

        setTimeout(function () {
            if (body.hasClass('sidebar-fullscreen') != true && body.hasClass('sidebar-overlay') != true) {
                body.addClass('menu-close');
            }
        }, 1000);

        body.on("click", function (e) {
            if (body.hasClass('sidebar-fullscreen') != true && body.hasClass('sidebar-overlay') != true) {
                if (!sidebarwrap.is(e.target) && sidebarwrap.has(e.target).length === 0) {
                    body.addClass('menu-close');
                }

            }
            else {
                body.removeClass('menu-close');
            }
        });
    }
    else {
        body.removeClass('menu-close');
    }
}

/* animate value */
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/* scroll bottom position and activity */
function scrolledtobottom() {
    if ($(window).scrollTop() + $(window).height() == $(document).height()) {
        $('.chatboxes.bottom-0').removeClass('mb-2').addClass('mb-4 pb-2');
        $('.rightbar-wrap').removeClass('pb-3');
    } else {
        $('.chatboxes.bottom-0').removeClass('mb-4 pb-2').addClass('mb-2');
        $('.rightbar-wrap').addClass('pb-3');
    }
}
