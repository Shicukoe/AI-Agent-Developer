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
    progressCirclesblue2.animate(0.75);  // Number from 0.0 to 1.0


    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 65);
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
    var gradientred = areachartred.createLinearGradient(0, 0, 0, 65);
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
    var gradientgreen = areachartgreen.createLinearGradient(0, 0, 0, 65);
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
    var gradientyellow = areachartyellow.createLinearGradient(0, 0, 0, 65);
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
    var gradientmediumgreen = areachartmediumgreen.createLinearGradient(0, 0, 0, 150);
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
                        display: true,
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


    window.randomScalingFactor2 = function () {
        return Math.round(Math.random() * 10);
    }
    var areachartblue = document.getElementById('areachartblue11').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 195);
    gradientblue.addColorStop(0, 'rgba(1, 94, 194, 1)');
    gradientblue.addColorStop(1, 'rgba(0, 197, 221, 0.1)');
    var gradientred1 = areachartblue.createLinearGradient(0, 0, 0, 190);
    gradientred1.addColorStop(0, 'rgba(240, 61, 79, 1)');
    gradientred1.addColorStop(1, 'rgba(255, 223, 220, 0.3)');
    var gradientgreen1 = areachartblue.createLinearGradient(0, 0, 0, 195);
    gradientgreen1.addColorStop(0, 'rgba(145, 195, 0, 1)');
    gradientgreen1.addColorStop(1, 'rgba(176, 197, 0, 0.1)');
    var myareachartblue = {
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
                backgroundColor: gradientgreen1,
                borderColor: '#91C300',
                borderWidth: 1,
                borderRadius: 15,
                fill: true,
                tension: 0.0,
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
                borderRadius: 15,
                fill: true,
                tension: 0.0,
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
                borderColor: 'rgba(1, 94, 194, 0.4)',
                borderWidth: 1,
                borderRadius: 15,
                fill: true,
                tension: 0.0,
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
                    ticks: {
                        beginAtZero: true,
                        display: true,
                        color: '#999999',
                    },
                    display: true,
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


    var areachartarea11 = document.getElementById('areachartarea11').getContext('2d');
    var gradientblue11 = areachartarea11.createLinearGradient(0, 0, 0, 195);
    gradientblue11.addColorStop(0, 'rgba(1, 94, 194, 0.4)');
    gradientblue11.addColorStop(1, 'rgba(0, 197, 221, 0)');
    var gradientred11 = areachartarea11.createLinearGradient(0, 0, 0, 190);
    gradientred11.addColorStop(0, 'rgba(240, 61, 79, 0.4)');
    gradientred11.addColorStop(1, 'rgba(255, 223, 220, 0)');
    var gradientgreen11 = areachartarea11.createLinearGradient(0, 0, 0, 195);
    gradientgreen11.addColorStop(0, 'rgba(145, 195, 0, 0.85)');
    gradientgreen11.addColorStop(1, 'rgba(176, 197, 0, 0)');
    var myareachartarea11 = {
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
                backgroundColor: gradientgreen11,
                borderColor: '#91C300',
                borderWidth: 1,
                fill: true,
                tension: 0.0,
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
                backgroundColor: gradientred11,
                borderColor: 'rgba(240, 61, 79, 0.65)',
                borderWidth: 1,
                fill: true,
                tension: 0.0,
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
                backgroundColor: gradientblue11,
                borderColor: 'rgba(1, 94, 194, 0.4)',
                borderWidth: 1,
                fill: true,
                tension: 0.0,
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
    var mysareachartarea11 = new Chart(areachartarea11, myareachartarea11);
    /* my area chart randomize */
    setInterval(function () {
        mysareachartarea11.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        mysareachartarea11.update();
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

    /* semi doughnut chart js */
    var semidoughnutchart = document.getElementById('semidoughnutchart').getContext('2d');
    var semidata = {
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
    var mysemidoughnutchartCofig = {
        type: 'doughnut',
        data: semidata,
        options: {
            circumference: 180,
            rotation: -90,
            responsive: true,
            cutout: 80,
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
            },
            layout: {
                padding: 0,
            },
        },
    };
    var mysemidoughnutchart = new Chart(semidoughnutchart, mysemidoughnutchartCofig);
});
