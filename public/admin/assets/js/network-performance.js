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


    /* area chart green medium size */
    var areachartmediumgreen = document.getElementById('mediumchartgreen1').getContext('2d');
    var gradientmediumgreen = areachartmediumgreen.createLinearGradient(0, 0, 0, 65);
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
    var gradientmediumred = areachartmediumred.createLinearGradient(0, 0, 0, 65);
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


    /* vertical bar chart */
    var barchartvert = document.getElementById('barchartvert').getContext('2d');
    var mybarchartvertCofig = {
        type: 'bar',
        data: {
            labels: ['United States', 'Russia', 'Canada', 'United Kingdom', 'Australia', 'Brazil'],
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
                backgroundColor: '#d7e6f5',
                borderWidth: 0,
                borderRadius: 0,
                borderSkipped: false,
                barThickness: 12,
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
                backgroundColor: '#015ec2',
                borderWidth: 0,
                borderRadius: 0,
                borderSkipped: false,
                barThickness: 12,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: {
                    top: 0,
                    bottom: 0
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
                        display: true,
                    },
                    drawBorder: true,
                    label: false,
                    grid: {
                        display: false,
                        zeroLineColor: 'rgba(219,219,219,0.3)',
                        drawBorder: true,
                        lineWidth: 1,
                        zeroLineWidth: 1
                    }
                },
                x: {
                    display: false,
                    ticks: {
                        beginAtZero: false,
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
    var myBarChartvert = new Chart(barchartvert, mybarchartvertCofig);
    /* my area chart randomize */
    setInterval(function () {
        mybarchartvertCofig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myBarChartvert.update();
    }, 2000);


    /* select chosen */
    $(".chosenoptgroup.two").chosen();
    var textdisplay_element = $(".chosenoptgroup.one + .chosen-container .chosen-single > span");
    var selected_element = $(".chosenoptgroup.one option:selected");
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

    /* jqvmap */
    var sample_data = { "af": "16.63", "al": "11.58", "dz": "158.97", "ao": "85.81", "ag": "1.1", "ar": "351.02", "am": "8.83", "au": "1219.72", "at": "366.26", "az": "52.17", "bs": "7.54", "bh": "21.73", "bd": "105.4", "bb": "3.96", "by": "52.89", "be": "461.33", "bz": "1.43", "bj": "6.49", "bt": "1.4", "bo": "19.18", "ba": "16.2", "bw": "12.5", "br": "2023.53", "bn": "11.96", "bg": "44.84", "bf": "8.67", "bi": "1.47", "kh": "11.36", "cm": "21.88", "ca": "1563.66", "cv": "1.57", "cf": "2.11", "td": "7.59", "cl": "199.18", "cn": "5745.13", "co": "283.11", "km": "0.56", "cd": "12.6", "cg": "11.88", "cr": "35.02", "ci": "22.38", "hr": "59.92", "cy": "22.75", "cz": "195.23", "dk": "304.56", "dj": "1.14", "dm": "0.38", "do": "50.87", "ec": "61.49", "eg": "216.83", "sv": "21.8", "gq": "14.55", "er": "2.25", "ee": "19.22", "et": "30.94", "fj": "3.15", "fi": "231.98", "fr": "2555.44", "ga": "12.56", "gm": "1.04", "ge": "11.23", "de": "3305.9", "gh": "18.06", "gr": "305.01", "gd": "0.65", "gt": "40.77", "gn": "4.34", "gw": "0.83", "gy": "2.2", "ht": "6.5", "hn": "15.34", "hk": "226.49", "hu": "132.28", "is": "12.77", "in": "1430.02", "id": "695.06", "ir": "337.9", "iq": "84.14", "ie": "204.14", "il": "201.25", "it": "2036.69", "jm": "13.74", "jp": "5390.9", "jo": "27.13", "kz": "129.76", "ke": "32.42", "ki": "0.15", "kr": "986.26", "undefined": "5.73", "kw": "117.32", "kg": "4.44", "la": "6.34", "lv": "23.39", "lb": "39.15", "ls": "1.8", "lr": "0.98", "ly": "77.91", "lt": "35.73", "lu": "52.43", "mk": "9.58", "mg": "8.33", "mw": "5.04", "my": "218.95", "mv": "1.43", "ml": "9.08", "mt": "7.8", "mr": "3.49", "mu": "9.43", "mx": "1004.04", "md": "5.36", "mn": "5.81", "me": "3.88", "ma": "91.7", "mz": "10.21", "mm": "35.65", "na": "11.45", "np": "15.11", "nl": "770.31", "nz": "138", "ni": "6.38", "ne": "5.6", "ng": "206.66", "no": "413.51", "om": "53.78", "pk": "174.79", "pa": "27.2", "pg": "8.81", "py": "17.17", "pe": "153.55", "ph": "189.06", "pl": "438.88", "pt": "223.7", "qa": "126.52", "ro": "158.39", "ru": "1476.91", "rw": "5.69", "ws": "0.55", "st": "0.19", "sa": "434.44", "sn": "12.66", "rs": "38.92", "sc": "0.92", "sl": "1.9", "sg": "217.38", "sk": "86.26", "si": "46.44", "sb": "0.67", "za": "354.41", "es": "1374.78", "lk": "48.24", "kn": "0.56", "lc": "1", "vc": "0.58", "sd": "65.93", "sr": "3.3", "sz": "3.17", "se": "444.59", "ch": "522.44", "sy": "59.63", "tw": "426.98", "tj": "5.58", "tz": "22.43", "th": "312.61", "tl": "0.62", "tg": "3.07", "to": "0.3", "tt": "21.2", "tn": "43.86", "tr": "729.05", "tm": 0, "ug": "17.12", "ua": "136.56", "ae": "239.65", "gb": "2258.57", "us": "14624.18", "uy": "40.71", "uz": "37.72", "vu": "0.72", "ve": "285.21", "vn": "101.99", "ye": "30.02", "zm": "15.69", "zw": "5.57" };
    $('#vmap').vectorMap({
        map: 'world_en',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        color: '#DDDDDD',
        borderColor: 'rgba(0, 0, 0, 0)',
        hoverOpacity: 0.7,
        selectedColor: '#91C300',
        enableZoom: false,
        showTooltip: true,
        values: sample_data,
        scaleColors: ['#f6fafd', '#015EC2'],
        normalizeFunction: 'polynomial'
    });
});
