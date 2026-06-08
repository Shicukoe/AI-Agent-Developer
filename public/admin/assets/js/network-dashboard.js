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
    var progressCirclesgreen = new ProgressBar.Circle(circleprogressgreen, {
        color: '#91C300',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(120, 195, 0, 0.15)',
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
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred.text.style.fontSize = '20px';
    progressCirclesgreen.animate(0.45);  // Number from 0.0 to 1.0

    /* circular progress */
    var progressCircleredbug = new ProgressBar.Circle(circleprogressredbug, {
        color: '#dd2739',
        // This has to be the same size as the maximum width to
        // prevent clipping
        strokeWidth: 10,
        trailWidth: 10,
        easing: 'easeInOut',
        trailColor: 'rgba(240, 61, 79, 0.15)',
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
                //  circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred.text.style.fontSize = '20px';
    progressCircleredbug.animate(0.68);  // Number from 0.0 to 1.0

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
                // circle.setText('');
            } else {
                // circle.setText(value + "<small>%<small>");
            }

        }
    });
    // progressCirclesred1.text.style.fontSize = '20px';
    progressCirclesblue2.animate(0.75);  // Number from 0.0 to 1.0


    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 50);
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

    var areachartred = document.getElementById('areachartred1').getContext('2d');
    var gradientred = areachartred.createLinearGradient(0, 0, 0, 50);
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
                radius: 0,
                backgroundColor: gradientred,
                borderColor: '#f03d4f',
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
    var gradientgreen = areachartgreen.createLinearGradient(0, 0, 0, 50);
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
                radius: 0,
                backgroundColor: gradientgreen,
                borderColor: '#91C300',
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
    var gradientyellow = areachartyellow.createLinearGradient(0, 0, 0, 50);
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
                radius: 0,
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

    /* area chart green medium size */
    var areachartmediumgreen = document.getElementById('mediumchartgreen1').getContext('2d');
    var gradientmediumgreen = areachartmediumgreen.createLinearGradient(0, 0, 0, 90);
    gradientmediumgreen.addColorStop(0, 'rgba(145, 195, 0, 0.85)');
    gradientmediumgreen.addColorStop(1, 'rgba(176, 197, 0, 0)');
    var myareachartmediumgreenConfig = {
        type: 'line',
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
                backgroundColor: gradientmediumgreen,
                borderColor: '#91C300',
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
                    ticks: {
                        color: '#999999'
                    },
                    display: false,
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
                    display: false,
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
    var gradientmediumred = areachartmediumred.createLinearGradient(0, 0, 0, 90);
    gradientmediumred.addColorStop(0, 'rgba(240, 61, 79, 0.85)');
    gradientmediumred.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var myareachartmediumredConfig = {
        type: 'line',
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
                borderColor: '#f03d4f',
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
                    ticks: {
                        color: '#999999'
                    },
                    display: false,
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
                    display: false,
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

    /* area chart yelow large size */
    var areachartchartserver = document.getElementById('chartserver').getContext('2d');
    var gradientchartserver = areachartchartserver.createLinearGradient(0, 0, 0, 230);
    gradientchartserver.addColorStop(0, 'rgba(255, 193, 7, 0.95)');
    gradientchartserver.addColorStop(1, 'rgba(255, 193, 7, 0)');
    var myareachartchartserverConfig = {
        type: 'line',
        data: {
            labels: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25', '00:30', '00:35', '00:40', '00:45', '00:50', '00:55', '01:00',
                '01:05', '01:10', '01:15', '01:20', '01:25', '01:30',
            ],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(),
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(),
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(),
                ],
                radius: 0,
                backgroundColor: gradientchartserver,
                borderColor: '#ffc107',
                borderWidth: 1,
                fill: true,
                tension: 0,
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
                        display: true,
                        color: 'rgba(0,0,0,0.04)',
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
                        display: true,
                        color: 'rgba(0,0,0,0.04)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                }
            }
        }
    }
    var myAreaChartchartserver = new Chart(areachartchartserver, myareachartchartserverConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartchartserverConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartchartserver.update();
    }, 1500);


    /* bar chart */
    var barchart = document.getElementById('barchart').getContext('2d');
    var mybarchartCofig = {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                backgroundColor: '#d7e6f5',
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 8,
            },
            {
                label: '# of Votes',
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                ],
                backgroundColor: '#015ec2',
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: -10
                }
            },
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    ticks: {
                        display: false,
                    },
                    drawBorder: false,
                    label: false,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(219,219,219,0.3)',
                        drawBorder: false,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                },
                x: {
                    ticks: {
                        beginAtZero: true,
                        display: false,
                        color: '#999999',
                        font: {
                            size: 12,
                        },
                    },
                    grid: {
                        display: false,
                    },
                }
            }
        }
    }
    var myBarChart = new Chart(barchart, mybarchartCofig);
    /* my area chart randomize */
    setInterval(function () {
        mybarchartCofig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myBarChart.update();
    }, 2000);


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

    $(".chosenoptgroup.two").chosen();
    var textdisplay_element = $(".chosenoptgroup.two + .chosen-container .chosen-single > span");
    var selected_element = $(".chosenoptgroup.two option:selected");
    var selected_value = selected_element.val();
    if (selected_element.closest('optgroup').length > 0) {
        var parent_optgroup = selected_element.closest('optgroup').attr('label');
        textdisplay_element.text(parent_optgroup + ' ' + selected_value).trigger("chosen:updated");
    }
    $(".chosenoptgroup.two").on('change', function (event, el) {
        textdisplay_element = $(".chosenoptgroup.two + .chosen-container .chosen-single > span");
        selected_element = $(".chosenoptgroup.two option:selected");
        selected_value = selected_element.val();
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

    $('.footable2').footable({
        "paging": {
            "enabled": true,
            "container": '#footable-pagination2',
            "countFormat": "{CP} of {TP}",
            "limit": 3,
            "position": "right",
            "size": 4
        },
        "sorting": {
            "enabled": true
        },
    }, function (ft) {
        $('#footablestot2').html($('#footable-pagination2 .footable-pagination-wrapper .label').html())

        $('#footable-pagination2 .footable-pagination-wrapper ul.pagination li').on('click', function () {
            setTimeout(function () {
                $('#footablestot2').html($('#footable-pagination2 .footable-pagination-wrapper .label').html());
            }, 200);
        });

    });

    $('.footable3').footable({
        "paging": {
            "enabled": true,
            "container": '#footable-pagination3',
            "countFormat": "{CP} of {TP}",
            "limit": 3,
            "position": "right",
            "size": 3
        },
        "sorting": {
            "enabled": true
        },
    }, function (ft) {
        $('#footablestot3').html($('#footable-pagination3 .footable-pagination-wrapper .label').html())

        $('#footable-pagination3 .footable-pagination-wrapper ul.pagination li').on('click', function () {
            setTimeout(function () {
                $('#footablestot3').html($('#footable-pagination3 .footable-pagination-wrapper .label').html());
            }, 200);
        });

    });


});
