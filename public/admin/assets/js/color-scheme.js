'use strict'
$(document).ready(function () {

    var html = $('html');
    var body = $('body');

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


    /* layout modes dark-light */
    if (getCookie("WinDOORSlayoutmode") === 'dark-mode') {
        $('#btn-layout-modes-dark').prop('checked', true);
        html.addClass('dark-mode');
    } else {
        $('#btn-layout-modes-dark').prop('checked', false);
        html.removeClass('dark-mode');
    }

    $('#btn-layout-modes-dark').on('click', function () {
        if ($(this).is(':checked')) {
            setCookie('WinDOORSlayoutmode', 'dark-mode', 1);
            html.attr('class', getCookie("WinDOORSlayoutmode"));
        } else {
            setCookie('WinDOORSlayoutmode', 'light-mode', 1);
            html.attr('class', getCookie("WinDOORSlayoutmode"));
        }
    });


    /* Right to left to right directions  */
    if (getCookie('WinDOORSdirectionmode') === 'rtl') {
        $('#btn-layout-RTL').prop('checked', true);
        html.addClass('rtl');
        html.attr('dir', 'ltr');

    } else {
        $('#btn-layout-RTL').prop('checked', false);
        html.attr('dir', '');
        html.removeClass('rtl');
    }

    $('#btn-layout-RTL').on('click', function () {
        if ($(this).is(':checked')) {
            setCookie('WinDOORSdirectionmode', 'rtl', 1);
            html.attr('dir', 'rtl');
            html.addClass('rtl');

        } else {
            setCookie('WinDOORSdirectionmode', 'ltr', 1);
            html.attr('dir', '');
            html.removeClass('rtl');
        }
    });



    /* color style  */
    var curentstyle = body.attr('data-theme');
    if ($.type(getCookie("WinDOORStheme")) != 'undefined' && getCookie("WinDOORStheme") != '') {

        body.addClass(getCookie("WinDOORStheme"));
        body.attr('data-theme', getCookie("WinDOORStheme"));
        curentstyle = getCookie("WinDOORStheme");

        $('#theme-select .select-box').each(function () {
            if ($(this).attr('data-title') === getCookie("WinDOORStheme")) {
                $(this).addClass("active");
            }
        });
        $('.personalise-color-list li').each(function () {
            if ($(this).attr('data-title') === getCookie("WinDOORStheme")) {
                $(this).addClass("active");
            }
        });
    }

    $('.personalise-color-list li').on('click', function () {
        body.removeClass(body.attr('data-theme'));

        $('.personalise-color-list li').removeClass('active');
        var setstyle = $(this).attr('data-title');

        if ($(this).find('img').length > 0) {
            var mainbgimage = $(this).find('img').attr('src');
            setCookie('WinDOORSsetimagepath', mainbgimage, 1);
            $('.main-bg').each(function () {
                $(this).css('background-image', 'url(' + mainbgimage + ')');
            });
        }

        if ($(this).hasClass('active') != true && setstyle != '') {
            $(this).addClass('active');
            body.addClass(setstyle).attr('data-theme', setstyle);
            setCookie('WinDOORStheme', setstyle, 1);
            curentstyle = setstyle;
        }

        if ($('.personalise-preview').length > 0) {

        }
    });

    $('#theme-select').find('.select-box').each(function () {

        $(this).on('click', function () {
            $('#theme-select').find('.select-box').removeClass('active');

            if ($(this).hasClass('active') != true && setstyle != '') {
                var curentstyle = body.attr('data-theme');
                var setstyle = $(this).attr('data-title');

                $(this).addClass('active');
                body.removeClass(curentstyle).addClass(setstyle).attr('data-theme', setstyle);
                setCookie('WinDOORStheme', setstyle, 1);
                curentstyle = setstyle;
            }
        });
    });

    /* background images */
    if ($.type(getCookie("WinDOORSsetimagepath")) != 'undefined' && getCookie("WinDOORSsetimagepath") != '') {

        $('.main-bg').each(function () {
            $(this).find('img').attr('src', getCookie("WinDOORSsetimagepath"));
            $(this).css('background-image', 'url("' + getCookie("WinDOORSsetimagepath") + '")');
        });

        $('#theme-background .select-box').each(function () {
            if ($(this).attr('data-src') === getCookie("WinDOORSsetimagepath")) {
                $(this).addClass("active");
            }
        });
    }
    $('#theme-background .select-box').on('click', function () {
        $('#theme-background .select-box').removeClass('active');
        $('.main-bg').removeClass(getCookie("WinDOORSsetimagepath"));
        var mainbgimage = $(this).find('img').attr('src');

        $(this).addClass("active");
        setCookie('WinDOORSsetimagepath', mainbgimage, 1);
        $('.main-bg').each(function () {
            $(this).css('background-image', 'url(' + mainbgimage + ')');
        });
    });

    /* sidebar type */
    if ($.type(getCookie("WinDOORSsidebarfilled")) != 'undefined' && getCookie("WinDOORSsidebarfilled") != '') {
        body.addClass(getCookie("WinDOORSsidebarfilled"));

        $('.personalise-preview-sidebar').each(function () {
            $(this).removeClass("active");
            if ($(this).attr('data-title') === getCookie("WinDOORSsidebarfilled")) {
                $(this).addClass("active");
            }
        });
    }
    $('.personalise-preview-sidebar').on('click', function () {
        var setSidebarfill = $(this).attr('data-title');

        $('.personalise-preview-sidebar').removeClass('active');
        $(this).addClass("active");

        if (setSidebarfill != "") {
            body.removeClass(getCookie("WinDOORSsidebarfilled")).addClass(setSidebarfill);
            setCookie('WinDOORSsidebarfilled', setSidebarfill, 1);
        } else {
            body.removeClass(getCookie("WinDOORSsidebarfilled"));
            removeCookie('WinDOORSsidebarfilled');
        }
    });



    /* sidebar style */
    var currentstyle = body.attr('data-sidebarstyle');

    if ($.type(getCookie("WinDOORSsidebarStyle")) != 'undefined' && getCookie("WinDOORSsidebarStyle") != '') {
        body.removeClass(currentstyle).addClass(getCookie("WinDOORSsidebarStyle")).attr('data-sidebarstyle', getCookie("WinDOORSsidebarStyle"));

        $('.sidebarstyle').each(function () {
            $(this).removeClass("active");
            if ($(this).attr('data-title') === getCookie("WinDOORSsidebarStyle")) {
                $(this).addClass("active");
            }
        });
    }
    $('.sidebarstyle').on('click', function () {
        var setSidebarStyle = $(this).attr('data-title');
        var currentstyle = body.attr('data-sidebarstyle');
        body.removeClass(currentstyle).attr('data-sidebarstyle', setSidebarStyle);

        $('.sidebarstyle').removeClass('active');
        $(this).addClass("active");

        if (setSidebarStyle != "") {
            body.removeClass(getCookie("WinDOORSsidebarStyle")).addClass(setSidebarStyle);
            setCookie('WinDOORSsidebarStyle', setSidebarStyle, 1);
        } else {
            body.removeClass(getCookie("WinDOORSsidebarStyle"));
            removeCookie('WinDOORSsidebarStyle');
        }
    });


    /* header logo, photo and user name */
    if ("WinDOORSlogopath" in sessionStorage) {
        $('.header .navbar-brand img').attr('src', sessionStorage.getItem('WinDOORSlogopath'));
    }
    if ("WinDOORSuserimg1" in sessionStorage) {
        $('#userprofiledd img, #userphotoonboarding3, .ususerphotoonboarding').parent().css('background-image', sessionStorage.getItem('WinDOORSuserimg1'));
    }
    if (getCookie('WinDOORSusername') != '') {
        $('#userprofiledd .username').html(getCookie('WinDOORSusername'));
    }

});