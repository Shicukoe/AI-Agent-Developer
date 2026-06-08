'use strict'
$(window).on('load', function () {

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
    progressCirclesblue1.animate(0.12);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesgreen1 = new ProgressBar.Circle(circleprogressgreen1, {
        color: '#6f42c1',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(111, 66, 193, 0.15)',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#6f42c1', width: 10 },
        to: { color: '#6f42c1', width: 10 },
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
    progressCirclesgreen1.animate(0.40);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesyellow1 = new ProgressBar.Circle(circleprogressyellow1, {
        color: '#E50A8E',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(229, 10, 142, 0.15)',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#E50A8E', width: 10 },
        to: { color: '#E50A8E', width: 10 },
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
    progressCirclesyellow1.animate(0.28);  // Number from 0.0 to 1.0

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
    progressCirclesred1.animate(0.20);  // Number from 0.0 to 1.0

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

    /* table data master */
    $('.footable').footable({
        "paging": {
            "enabled": true,
            "container": '#footable-pagination',
            "countFormat": "{CP} of {TP}",
            "limit": 3,
            "position": "right",
            "size": 5
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
