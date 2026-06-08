'use strict'
$(window).on('load', function () {

    /* Swiper slider */
    var swiper = new Swiper(".pricecurrentswiper", {
        slidesPerView: 'auto',
        spaceBetween: 14,
        pagination: {
            el: ".swiper-pagination",
        },
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
    });

    var swiper2 = new Swiper(".creditcards", {
        slidesPerView: "auto",
        spaceBetween: 10,
        centeredSlides: true,
        autoplay: false,
    });



    /* circular progress */
    var progressCirclesblue1 = new ProgressBar.Circle(circleprogressblue1, {
        color: '#015EC2',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(66, 157, 255, 0.15)',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#015EC2', width: 10 },
        to: { color: '#015EC2', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                circle.setText('');
            } else {
                circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesblue1.text.style.fontSize = '20px';
    progressCirclesblue1.animate(0.65);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesgreen1 = new ProgressBar.Circle(circleprogressgreen1, {
        color: '#91C300',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: '#eaf4d8',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#91C300', width: 10 },
        to: { color: '#91C300', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                circle.setText('');
            } else {
                circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesgreen1.text.style.fontSize = '20px';
    progressCirclesgreen1.animate(0.85);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesyellow1 = new ProgressBar.Circle(circleprogressyellow1, {
        color: '#fdba00',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: '#fff2ce',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#fdba00', width: 10 },
        to: { color: '#fdba00', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                circle.setText('');
            } else {
                circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesyellow1.text.style.fontSize = '20px';
    progressCirclesyellow1.animate(0.45);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesred1 = new ProgressBar.Circle(circleprogressred1, {
        color: '#dd2739',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: '#fbe0e4',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#dd2739', width: 10 },
        to: { color: '#dd2739', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                circle.setText('');
            } else {
                circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred1.text.style.fontSize = '20px';
    progressCirclesred1.animate(0.68);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesblue2 = new ProgressBar.Circle(circleprogressblue2, {
        color: '#015EC2',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(66, 157, 255, 0.15)',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#015EC2', width: 10 },
        to: { color: '#015EC2', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                circle.setText('');
            } else {
                circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred1.text.style.fontSize = '20px';
    progressCirclesblue2.animate(0.56);  // Number from 0.0 to 1.0


    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }

    window.randomScalingFactor2 = function () {
        return Math.round(Math.random() * 10);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 60);
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
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: gradientblue,
                borderColor: '#015EC2',
                borderWidth: 1,
                fill: true,
                tension: 0.4,
            }]
        },
        options: {
            layout: {
                padding: 0
            },
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

    var areachartred = document.getElementById('areachartred1').getContext('2d');
    var gradientred = areachartred.createLinearGradient(0, 0, 0, 60);
    gradientred.addColorStop(0, 'rgba(240, 61, 79, 0.85)');
    gradientred.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var myareachartredConfig = {
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
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: gradientred,
                borderColor: '#f03d4f',
                borderWidth: 1,
                fill: true,
                tension: 0.4,
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
    var myAreaChartred = new Chart(areachartred, myareachartredConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartredConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartred.update();
    }, 1500);


    var areachartgreen = document.getElementById('areachartgreen1').getContext('2d');
    var gradientgreen = areachartgreen.createLinearGradient(0, 0, 0, 60);
    gradientgreen.addColorStop(0, 'rgba(145, 195, 0, 0.85)');
    gradientgreen.addColorStop(1, 'rgba(176, 197, 0, 0)');
    var myareachartgreenConfig = {
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
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: gradientgreen,
                borderColor: '#91C300',
                borderWidth: 1,
                fill: true,
                tension: 0.4,
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
    var myAreaChartgreen = new Chart(areachartgreen, myareachartgreenConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartgreenConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartgreen.update();
    }, 1500);


    var areachartyellow = document.getElementById('areachartyellow1').getContext('2d');
    var gradientyellow = areachartyellow.createLinearGradient(0, 0, 0, 60);
    gradientyellow.addColorStop(0, 'rgba(253, 100, 0, 0.85)');
    gradientyellow.addColorStop(1, 'rgba(253, 186, 0, 0)');
    var myareachartyellowConfig = {
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
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: gradientyellow,
                borderColor: '#fdba00',
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
    var myAreaChartyellow = new Chart(areachartyellow, myareachartyellowConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartyellowConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartyellow.update();
    }, 1500);

    /* bar chart */
    var areachart = document.getElementById('areachart1').getContext('2d');
    var areachart1 = areachart.createLinearGradient(0, 0, 0, 195);
    areachart1.addColorStop(0, 'rgba(1, 94, 194, 0.4)');
    areachart1.addColorStop(1, 'rgba(0, 197, 221, 0)');
    var areachart2 = areachart.createLinearGradient(0, 0, 0, 190);
    areachart2.addColorStop(0, 'rgba(240, 61, 79, 0.4)');
    areachart2.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var areachart3 = areachart.createLinearGradient(0, 0, 0, 195);
    areachart3.addColorStop(0, 'rgba(145, 195, 0, 0.85)');
    areachart3.addColorStop(1, 'rgba(176, 197, 0, 0)');
    var myareachart = {
        type: 'bar',
        data: {
            labels: ['Jan-15', 'Jan-30', 'Feb-15', 'Feb-30', 'Mar-15', 'Mar-30', 'Apr-15', 'Apr-30', 'May-15', 'May-30', 'Jun-15', 'Jun-30', 'Jul-15', 'Jul-30', 'Aug-15', 'Aug-30'],
            datasets: [{
                label: '# income',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: areachart3,
                borderColor: '#91C300',
                borderWidth: 1,
                fill: true,
                tension: 0.3,
            }, {
                label: '# of Expense',
                data: [
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                ],
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: areachart2,
                borderColor: 'rgba(240, 61, 79, 0.65)',
                borderWidth: 1,
                fill: true,
                tension: 0.3,
            }, {
                label: '# of Investments',
                data: [
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                    randomScalingFactor2(),
                ],
                radius: 2,
                pointBackgroundColor: '#ffffff',
                backgroundColor: areachart1,
                borderColor: 'rgba(1, 94, 194, 0.4)',
                borderWidth: 1,
                fill: true,
                tension: 0.3,
            }]
        },
        options: {
            layout: {
                padding: 0,
            },
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    display: true,
                    grid: {
                        display: false
                    },
                    beginAtZero: true,
                },
                x: {
                    grid: {
                        display: false
                    },
                    display: true,
                    beginAtZero: false,
                }
            }
        }
    }
    var myareachartexecu = new Chart(areachart, myareachart);
    /* my area chart randomize */
    setInterval(function () {
        myareachart.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myareachartexecu.update();
    }, 1500);

    /* doughnut chart js */
    var doughnutchart = document.getElementById('doughnutchart').getContext('2d');
    var data = {
        labels: ['Food', 'Transport', 'Children', 'Home', 'Other'],
        datasets: [
            {
                label: 'Expense categories',
                data: [40, 10, 15, 25, 10],
                backgroundColor: ['#ffbb00', '#91c300', '#ff6f6a', '#015ec2', '#becede'],
                borderWidth: 0,
            }
        ]
    };
    var mydoughnutchartCofig = {
        type: 'doughnut',
        data: data,

        options: {
            responsive: true,
            cutout: 62,
            tooltips: {
                position: 'nearest',
                yAlign: 'bottom'
            },
            plugins: {
                legend: {
                    display: false,
                    position: 'top',
                },
                title: {
                    display: false,
                    text: 'Chart.js Doughnut Chart'
                }
            }
        },
    };
    var mydoughnutchart = new Chart(doughnutchart, mydoughnutchartCofig);


    /* select chosen */
    $(".chosenoptgroup").chosen()
    $(".chosenoptgroup").on('change', function (event, el) {
        var textdisplay_element = $(".chosenoptgroup + .chosen-container .chosen-single > span");
        var selected_element = $(".chosenoptgroup option:selected");
        var selected_value = selected_element.val();
        if (selected_element.closest('optgroup').length > 0) {
            var parent_optgroup = selected_element.closest('optgroup').attr('label');
            textdisplay_element.text(parent_optgroup + ' ' + selected_value).trigger("chosen:updated");
        }
    });

    /* table data master */
    $('.footable').footable({
        "paging": {
            "enabled": true,
            "container": '#footable-pagination',
            "countFormat": "{CP} of {TP}",
            "limit": 3,
            "position": "right",
            "size": 4
        },
        "sorting": {
            "enabled": true
        },
    }, function (ft) {
        $('#footablestot').html($('.footable-pagination-wrapper .label').html())

        $('.footable-pagination-wrapper ul.pagination li').on('click', function () {
            setTimeout(function () {
                $('#footablestot').html($('.footable-pagination-wrapper .label').html());
            }, 200);
        });

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

});
