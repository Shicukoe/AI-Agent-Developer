'use strict'
$(window).on('load', function () {
    /* user name  and images from onboarding screen */
    if (sessionStorage.getItem('WinDOORSuserimg1') != '') {
        $('#userimage').parent().css('background-image', sessionStorage.getItem('WinDOORSuserimg1'));
        $('#userphotoonboarding').parent().css('background-image', sessionStorage.getItem('WinDOORSuserimg1'));
    }
    if (getCookie('WinDOORSusername') != '') {
        $('#usernamedisplay, #usernamedisplay2 span, .username').html(getCookie('WinDOORSusername'));
    }


    /* temperature data */
    var cityname = 'London';
    $('#citychange li').on('click', function () {
        if ($(this).text() != '') {
            $('#citychange li').removeClass('active');
            $(this).addClass('active')
            cityname = $(this).text();
            dataload();
        }
    })
    dataload();
    function dataload() {
        fetch('https://api.openweathermap.org/data/2.5/weather?q=' + cityname + '&APPID=ce2008ef871845f77c7f03aafe2d54eb&units=metric')
            /* change app id= "ce2008ef871845f77c7f03aafe2d54eb" with your id create from https://openweathermap.org/api current weather data */
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                appendData(data);
            })
            .catch(function (err) {
                console.log(err);
            });
    }
    function appendData(data) {
        $('#temperature').text(data.main.temp);
        $('#city').text(data.name);
        $('#tempimage').attr('src', 'assets/img/openweather-icon/light/' + data.weather[0].icon + '@2x.png');
    }

    /* search result show */
    var searchglobal = $('#searchglobal');
    var searchresultglobal = $('#searchresultglobal');

    searchglobal.on('keyup', function () {
        if (searchglobal.val() != '') {
            searchresultglobal.addClass('show');
        } else {
            searchresultglobal.removeClass('show');
        }
    });

    $("#searchtoggle").on('click', function () {
        $(".search-header").addClass("active");
    });
    $("#searchclose").on('click', function () {
        $(".search-header").removeClass("active");
    });

    body.on("click", function (e) {
        if (!searchresultglobal.is(e.target) && searchresultglobal.has(e.target).length === 0 && !searchglobal.is(e.target) && searchglobal.has(e.target).length === 0) {
            searchresultglobal.removeClass('show');
        }
    });
    if ($(window).width() >= 1200) {
        $('#searchclose').remove();
    }


    /* notification window calendar */
    $('#notificationdaterange').daterangepicker({
        "singleDatePicker": true,
        "showCustomRangeLabel": false,
        "alwaysShowCalendars": true,
        "parentEl": "#calendardisplay",
        "opens": "center",
        "applyButtonClasses": "btn-theme",
        "cancelClass": "btn-outline-secondary border"
    }, function (start, end, label) {

    });


    /*chat window open */
    $('.chatwindow').find('.list-group .list-group-item').on('click', function (e) {
        $('.chatboxes').fadeIn();

        setTimeout(function () {
            $('#thefirstchat').click();
        }, 400);
    });
    $('.chat-close').on('click', function () {
        $(this).closest('.chatboxes').fadeOut();
    })

    /* title calendar */
    $('#titlecalendar').daterangepicker({
        "minYear": 1989,
        "maxYear": 2025,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        "startDate": "12/08/2021",
        "endDate": "12/14/2021",
        "opens": "left",
        "drops": "down",
        "applyButtonClasses": "btn-theme",
        "cancelClass": "btn-outline-secondary border",
    }, function (start, end, label) {
        console.log('New date range selected: ' + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD') + ' (predefined range: ' + label + ')');
    });
    $('#titlecalandershow').on('click', function () {
        $('#titlecalendar').click()
    });

    /* chosen title filter dd */
    $("#titltfilterlist, #searchfilterlist").chosen({ no_results_text: "Oops, nothing found!", max_selected_options: 2 });
    $("#titltfilterlist, #searchfilterlist").bind("chosen:maxselected", function () {
        $(this).closest('.input-group').next('.invalid-feedback').show()
    });
    $("#titltfilterlist, #searchfilterlist").chosen().change(function () {
        if ($(this).find('option:selected').length < 2) {
            $(this).closest('.input-group').next('.invalid-feedback').hide()
        }
    });

});