'use strict'
$(window).on('load', function () {


    /* circular progress */
    var progressCircles1 = new ProgressBar.Circle(circleprogressblue, {
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
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCircles2.text.style.fontSize = '20px';
    progressCircles1.animate(0.65);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCircles2 = new ProgressBar.Circle(circleprogressyellow, {
        color: '#ffc107',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: '#fdf8e5',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#ffc107', width: 10 },
        to: { color: '#ffc107', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCircles2.text.style.fontSize = '20px';
    progressCircles2.animate(0.85);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclesred = new ProgressBar.Circle(circleprogressredsum, {
        color: '#f03d4f',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: '#fceaed',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#f03d4f', width: 10 },
        to: { color: '#f03d4f', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred.text.style.fontSize = '20px';
    progressCirclesred.animate(0.45);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCirclewhite = new ProgressBar.Circle(circleprogresswhite, {
        color: '#ffffff',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(255, 255, 255, 0.25)',
        duration: 1400,
        text: {
            autoStyleContainer: false
        },
        from: { color: '#ffffff', width: 10 },
        to: { color: '#ffffff', width: 10 },
        // Set default step function for all animate calls
        step: function (state, circle) {
            circle.path.setAttribute('stroke', state.color);
            circle.path.setAttribute('stroke-width', state.width);

            var value = Math.round(circle.value() * 100);
            if (value === 0) {
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred.text.style.fontSize = '20px';
    progressCirclewhite.animate(0.68);  // Number from 0.0 to 1.0

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

    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    window.randomScalingFactor2 = function () {
        return Math.round(Math.random() * 10);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 240);
    gradientblue.addColorStop(0, 'rgba(1, 94, 194, 0.55)');
    gradientblue.addColorStop(1, 'rgba(1, 94, 193, 0)');
    var gradientred1 = areachartblue.createLinearGradient(0, 0, 0, 235);
    gradientred1.addColorStop(0, 'rgba(240, 61, 79, 0.85)');
    gradientred1.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var gradientgreen1 = areachartblue.createLinearGradient(0, 0, 0, 240);
    gradientgreen1.addColorStop(0, 'rgba(255, 193, 7, 0.5)');
    gradientgreen1.addColorStop(1, 'rgba(255, 193, 7, 0)');
    var myareachartblue = {
        type: 'line',
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
                backgroundColor: gradientgreen1,
                borderColor: '#ffc107',
                borderWidth: 1,
                fill: true,
                tension: 0.35,
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
                backgroundColor: gradientred1,
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
                backgroundColor: gradientblue,
                borderColor: '#015ec2',
                borderWidth: 1,
                fill: true,
                tension: 0.4,
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
                    display: false,
                    beginAtZero: true,
                },
                x: {
                    grid: {
                        display: false
                    },
                    display: false,
                    beginAtZero: false,
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


});
