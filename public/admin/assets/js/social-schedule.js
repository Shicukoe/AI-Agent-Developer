'use strict'
$(window).on('load', function () {

    /* Swiper slider */
    var swiper = new Swiper(".categorychartswiper", {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        breakpoints: {
            640: {
                slidesPerView: 1,
            },
            768: {
                slidesPerView: 2,
            },
            992: {
                slidesPerView: 3,
            },
            1024: {
                slidesPerView: 3,
            },
            1200: {
                slidesPerView: 1,
            },
            1600: {
                slidesPerView: 2,
            },
        }
    });

    /* select chosen */
    $(".chosenoptgroup.one").chosen();
    var textdisplay_element = $(".chosenoptgroup.one + .chosen-container .chosen-single > span");
    var selected_element = $(".chosenoptgroup.one option:selected");
    var selected_value = selected_element.val();
    if (selected_element.closest('optgroup').length > 0) {
        var parent_optgroup = selected_element.closest('optgroup').attr('label');
        textdisplay_element.text(parent_optgroup + ' ' + selected_value).trigger("chosen:updated");
    }
    $(".chosenoptgroup.one").on('change', function (event, el) {
        textdisplay_element = $(".chosenoptgroup.one + .chosen-container .chosen-single > span");
        selected_element = $(".chosenoptgroup.one option:selected");
        selected_value = selected_element.val();
        if (selected_element.closest('optgroup').length > 0) {
            var parent_optgroup = selected_element.closest('optgroup').attr('label');
            textdisplay_element.text(parent_optgroup + ' ' + selected_value).trigger("chosen:updated");
        }
    });

    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 85);
    gradientblue.addColorStop(0, 'rgba(1, 94, 194, 0.85)');
    gradientblue.addColorStop(1, 'rgba(0, 197, 221, 0)');
    var myareachartblue = {
        type: 'line',
        data: {
            labels: ['1', '2', '3', '4', '5', '7', '8'],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                radius: 0,
                backgroundColor: gradientblue,
                borderColor: '#015EC2',
                borderWidth: 1,
                fill: true,
                tension: 0.5,
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    display: false,
                    beginAtZero: true,
                },
                x: {
                    display: false,
                }
            }
        }
    }
    var myAreaChartblue = new Chart(areachartblue, myareachartblue);
    /* my area chart randomize */
    setInterval(function () {
        myareachartblue.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartblue.update();
    }, 1500);

    /* table scheduler  */
    var scheduleTable = $('.table-scheduled');
    var cellavailableClick = scheduleTable.find('td:not(.disabled):not(:first-child)');
    var scrolltoptable = $('.header > .navbar').outerHeight();

    setTimeout(() => {
        $('.table-scheduled thead tr th:not(:first-child)').css('width', (scheduleTable.width() - 60) / 7);
        $('.table-scheduled tbody tr td:not(:first-child)').css('width', (scheduleTable.width() - 60) / 7);
    }, 100);

    setTimeout(() => {
        $('.table-scheduled thead').css({ 'top': 0, 'left': scheduleTable.offset().left + 1 });
    }, 150);

    /* table cell add event click */
    cellavailableClick.on('mouseenter', function () {
        if ($(this).find('.addEventbtn').length > 0) {
            //$('.addEventbtn').remove()
        } else {
            $(this).prepend('<div class="dropdown addEventbtn"><a class="btn btn-outline-theme btn-sm w-100 dd-arrow-none dropdown-toggle" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false" role="button"><i class="bi bi-plus"></i> Event ' + $(this).closest('tr').find('td:first-child').text() + '</a><ul class="dropdown-menu"><li><a class="dropdown-item" href="#" data-bs-toggle="modal" data-bs-target="#writepost"><i class="bi bi-pencil-square"></i> Add Post</a></li><li><a class="dropdown-item" href="javascript:void(0)" data-bs-toggle="modal" data-bs-target="#writepost"><i class="bi bi-newspaper"></i> Article </a></li><li><a class="dropdown-item" href="javascript:void(0)" data-bs-toggle="modal" data-bs-target="#writepost"><i class="bi bi-envelope"></i> Email</a></li><li><a class="dropdown-item" href="javascript:void(0)"><i class="bi bi-facebook"></i> Story</a></li><li><a class="dropdown-item" href="javascript:void(0)"><i class="bi bi-check-circle"></i> Task</a></li></ul></div>')
        }
        $(this).on('mouseleave', function () {
            $('.addEventbtn').remove()
        })
    });


    /* datepicker with time */
    $('#scheduledatepicker').daterangepicker({
        "singleDatePicker": true,
        "timePicker": true,
        "startDate": "01/01/2022",
        "endDate": "01/07/2022",
        "drops": "up",
        locale: {
            format: 'DD/MM/YYYY hh:mm A'
        }
    }, function (start, end, label) {
        //console.log('New date range selected: ' + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD') + ' (predefined range: ' + label + ')');
    });

    /* Inline date picker  */
    $('#daterangepickerinline').daterangepicker({
        "singleDatePicker": true,
        "timePicker": false,
        "alwaysShowCalendars": true,
        "startDate": "01/01/2022",
        "endDate": "01/07/2022",
        "parentEl": ".calendarinline",
        "opens": "center",
        "applyButtonClasses": "btn-theme",
        "cancelClass": "btn-outline-secondary border",
        "autoUpdateInput": true,
        locale: {
            format: 'DD/MM/YYYY hh:mm A'
        }
    }, function (start, end, label) {
    })
    $('#daterangepickerinline').on('showCalendar.daterangepicker', function (ev, picker) {
        $('.todaysdate').text(picker.startDate.format('DD/MM/YYYY')); // this will return and set date selected/changed
    });
    $('#daterangepickerinline').click(); // this will open default



    /* text editor tinyMCE */
    tinymce.init({
        selector: '#textareaeditor',
        menubar: false,
        toolbar_mode: 'floating',
        tinycomments_mode: 'embedded',
        plugins: 'image link autolink ',
        toolbar: 'undo redo | bold italic underline strikethrough | image link',
        branding: false,

        /* without images_upload_url set, Upload tab won't show up*/
        images_upload_url: 'postAcceptor.php',

        /* we override default upload handler to simulate successful upload*/
        images_upload_handler: function (blobInfo, success, failure) {
            setTimeout(function () {
                /* no matter what you upload, we will turn it into TinyMCE logo :)*/
                success('http://moxiecode.cachefly.net/tinymce/v9/images/logo.png');
            }, 2000);
        },
    });




});

$(window).on('resize', function () {
    /* table scheduler  */
    var scheduleTable = $('.table-scheduled');

    setTimeout(() => {
        $('.table-scheduled thead tr th:not(:first-child)').css('width', (scheduleTable.width() - 60) / 7);
        $('.table-scheduled tbody tr td:not(:first-child)').css('width', (scheduleTable.width() - 60) / 7);
    }, 100);

    setTimeout(() => {
        $('.table-scheduled thead').css({ 'top': 0, 'left': scheduleTable.offset().left + 1 })
    }, 150);

});

$(window).on('scroll', function () {
    var scheduleTable = $('.table-scheduled');


    /* scroll from top and add class */
    if ($(document).scrollTop() > (scheduleTable.offset().top - $('.header .navbar').outerHeight()) && $(document).scrollTop() < scheduleTable.outerHeight()) {
        $('.table-scheduled thead').addClass('position-fixed').find('th').css('padding-top', $('.header .navbar').outerHeight());;
        $('.table-scheduled tbody').css('margin-top', $('.header .navbar').outerHeight());
    } else {
        $('.table-scheduled thead').removeClass('position-fixed').find('th').css('padding-top', '0.5rem');
        $('.table-scheduled tbody').css('margin-top', 0);
    }

});
