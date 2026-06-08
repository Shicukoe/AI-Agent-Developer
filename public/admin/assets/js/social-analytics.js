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

    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    var areachartblue = document.getElementById('areachartblue1').getContext('2d');
    var gradientblue = areachartblue.createLinearGradient(0, 0, 0, 75);
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

    var areachartgreen = document.getElementById('areachartgreen1').getContext('2d');
    var gradientgreen = areachartgreen.createLinearGradient(0, 0, 0, 75);
    gradientgreen.addColorStop(0, 'rgba(0, 194, 255, 0.85)');
    gradientgreen.addColorStop(1, 'rgba(0, 194, 255, 0.0)');
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
                borderColor: '#00C2FF',
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
    var gradientmediumgreen = areachartmediumgreen.createLinearGradient(0, 0, 0, 150);
    gradientmediumgreen.addColorStop(0, 'rgba(145, 195, 0, 0.75)');
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
    var barchartwhite = document.getElementById('barchartwhite').getContext('2d');
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
                backgroundColor: '#ffffff',
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
                backgroundColor: 'rgba(255, 255,  255, 0.4)',
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
                    display: false,
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
    var myBarChartwhite = new Chart(barchartwhite, mybarchartCofig);
    /* my area chart randomize */
    setInterval(function () {
        mybarchartCofig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myBarChartwhite.update();
    }, 2000);


    /* bar chart red */
    var barchartred = document.getElementById('barchartred').getContext('2d');
    var mybarchartredCofig = {
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
                backgroundColor: '#f03d4f',
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 6,
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
                backgroundColor: 'rgba(240, 61, 79, 0.15)',
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
            },
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    display: false,
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
    var myBarChartred = new Chart(barchartred, mybarchartredCofig);
    /* my area chart randomize */
    setInterval(function () {
        mybarchartredCofig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myBarChartred.update();
    }, 2000);



    /* pink bar chart */
    var barchartpink = document.getElementById('barchartpink').getContext('2d');
    var mybarchartpinkCofig = {
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
                backgroundColor: '#E50A8E',
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 6,
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
                backgroundColor: 'rgba(229, 10, 142, 0.15)',
                borderWidth: 0,
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
            },
            scales: {
                y: {
                    display: false,
                    ticks: {
                        display: false,
                    },
                    drawBorder: false,
                    label: false,
                    grid: {
                        display: false,
                    }
                },
                x: {
                    display: true,
                    ticks: {
                        beginAtZero: false,
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
    var myBarChartpink = new Chart(barchartpink, mybarchartpinkCofig);

    /* my area chart randomize */
    setInterval(function () {
        mybarchartpinkCofig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myBarChartpink.update();
    }, 2000);

    /* area chart yelow large size */
    var areachartsocialtraffic = document.getElementById('socialtraffic').getContext('2d');
    var myareachartsocialtrafficConfig = {
        type: 'line',
        data: {
            labels: ['1 Feb', '2 Feb', '3 Feb', '4 Feb', '5 Feb', '6 Feb', '7 Feb'],
            datasets: [{
                label: '# of Votes',
                data: [
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(),
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor()
                ],
                radius: 0,
                borderColor: '#015EC2',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
            },
            {
                label: '# of Votes',
                data: [
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(),
                    randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor(), randomScalingFactor()
                ],
                radius: 0,
                borderColor: 'rgba(1, 94, 194, 0.2)',
                borderWidth: 2,
                fill: false,
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
    var myAreaChartsocialtraffic = new Chart(areachartsocialtraffic, myareachartsocialtrafficConfig);
    /* my area chart randomize */
    setInterval(function () {
        myareachartsocialtrafficConfig.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChartsocialtraffic.update();
    }, 1500);


    /* doughnut chart js */
    var doughnutchart = document.getElementById('doughnutchart').getContext('2d');
    var data = {
        labels: ['Female', 'Male', 'Other'],
        datasets: [
            {
                label: 'Expense categories',
                data: [55, 30, 15],
                backgroundColor: ['#ff6f6a', '#015ec2', '#becede'],
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
