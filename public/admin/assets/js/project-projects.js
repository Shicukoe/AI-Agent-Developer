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

    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    window.randomScalingFactor2 = function () {
        return Math.round(Math.random() * 10);
    }

    /* area chart green medium size */
    var areachartmediumgreen = document.getElementById('mediumchartgreen1').getContext('2d');
    var gradientmediumgreen = areachartmediumgreen.createLinearGradient(0, 0, 0, 150);
    gradientmediumgreen.addColorStop(0, 'rgba(145, 195, 0, 0.35)');
    gradientmediumgreen.addColorStop(1, 'rgba(176, 197, 0, 0)');
    var gradientmediumgreen2 = areachartmediumgreen.createLinearGradient(0, 0, 0, 150);
    gradientmediumgreen2.addColorStop(0, 'rgba(145, 195, 0, 0.85)');
    gradientmediumgreen2.addColorStop(1, 'rgba(176, 197, 0, 0.25)');
    var myareachartmediumgreenConfig = {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                backgroundColor: gradientmediumgreen,
                borderColor: 'rgba(145, 195, 0, 0.5)',
                borderWidth: 1,
                fill: true,
                tension: 0.5,
                barThickness: 10,
                borderRadius: 5,
            },
            {
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                backgroundColor: gradientmediumgreen2,
                borderColor: '#91C300',
                borderWidth: 1,
                fill: true,
                tension: 0.5,
                barThickness: 10,
                borderRadius: 5,
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
                    ticks: {
                        color: '#999999'
                    },
                    display: true,
                    beginAtZero: true,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(0,0,0,0.3)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                },
                x: {
                    ticks: {
                        color: '#999999',
                    },
                    display: true,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(0,0,0,0.3)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1,
                    }
                }
            }
        }
    }
    var myAreaChartmediumgreen = new Chart(areachartmediumgreen, myareachartmediumgreenConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartmediumgreenConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartmediumgreen.update();
    }, 1500);

    /* area chart red medium size */
    var areachartmediumred = document.getElementById('mediumchartred1').getContext('2d');
    var gradientmediumred = areachartmediumred.createLinearGradient(0, 0, 0, 150);
    gradientmediumred.addColorStop(0, 'rgba(240, 61, 79, 0.35)');
    gradientmediumred.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var gradientmediumred2 = areachartmediumred.createLinearGradient(0, 0, 0, 160);
    gradientmediumred2.addColorStop(0, 'rgba(240, 61, 79, 0.85)');
    gradientmediumred2.addColorStop(1, 'rgba(255, 223, 220, 0.25)');
    var myareachartmediumredConfig = {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                radius: 0,
                backgroundColor: gradientmediumred,
                borderColor: 'rgba(240, 61, 79, 0.35)',
                borderWidth: 1,
                borderRadius: 5,
                fill: true,
                tension: 0.5,
                barThickness: 10,
            }, {
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                radius: 0,
                backgroundColor: gradientmediumred2,
                borderColor: '#f03d4f',
                borderWidth: 1,
                borderRadius: 5,
                fill: true,
                tension: 0.5,
                barThickness: 10,
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
                    ticks: {
                        color: '#999999'
                    },
                    display: true,
                    beginAtZero: true,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(0,0,0,0.3)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                },
                x: {
                    ticks: {
                        color: '#999999'
                    },
                    display: true,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(0,0,0,0.3)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                }
            }
        }
    }
    var myAreaChartmediumred = new Chart(areachartmediumred, myareachartmediumredConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartmediumredConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartmediumred.update();
    }, 1500);

    /* doughnut chart js */
    var doughnutchart = document.getElementById('doughnutchart').getContext('2d');
    var doughnutchart2 = document.getElementById('doughnutchart2').getContext('2d');
    var data = {
        labels: ['Kids Play', 'Tools', 'Electronics', 'Decorative', 'Other'],
        datasets: [
            {
                label: 'Expense categories',
                data: [40, 10, 15, 25, 10],
                backgroundColor: ['rgba(255, 193, 7, 1)', 'rgba(145, 195, 0, 1)', 'rgba(240, 61, 79, 1)', 'rgba(1, 94, 194, 1)', 'rgba(111, 66, 193, 1)'],
                borderWidth: 0,
            }
        ]
    };
    var mydoughnutchartCofig = {
        type: 'doughnut',
        data: data,

        options: {
            responsive: true,
            cutout: 35,
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
                    text: 'Chart.js polarArea Chart'
                }
            }
        },
    };
    var mydoughnutchart = new Chart(doughnutchart, mydoughnutchartCofig);
    var mydoughnutchart2 = new Chart(doughnutchart2, mydoughnutchartCofig);

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


    /* app tour  */
    var tourOptions = {
        options: {
            darkLayerPersistence: true,
            next: 'Next',
            prev: 'Previous',
            finish: 'Okay!',
            // mobile threshold in pixels
            mobileThreshold: 768,
        },
        tips: [{
            title: '<h6>Drag and Drop</h6>',
            description: 'You can change status by dragging card to another status column. Try dragging card and drop to next column.',
            image: "assets/img/tour-guide-5.png",
            selector: '#todocolumnone',
            x: 94,
            y: 50,
            offx: 11,
            offy: 0,
            position: 'top',
            onSelected: false
        }]
    };
    var tour = window.ProductTourJS;
    tour.init(tourOptions);
    tour.start();
});
