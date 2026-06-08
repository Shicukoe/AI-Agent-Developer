'use strict'
$(window).on('load', function () {

    /* Swiper slider */
    var swiper = new Swiper(".swiper", {
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        loop: true,
    });

    var swiper2 = new Swiper(".creditcards", {
        slidesPerView: "auto",
        spaceBetween: 0,
        centeredSlides: true,
        autoplay: false,
    });

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

    var progressCircles3 = new ProgressBar.Circle(circleprogressred, {
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
    // progressCircles2.text.style.fontSize = '20px';
    progressCircles3.animate(0.45);  // Number from 0.0 to 1.0

    /* chart js areachart */
    window.randomScalingFactor = function () {
        return Math.round(Math.random() * 20);
    }
    var areachart2 = document.getElementById('smallchart2').getContext('2d');
    var gradient2 = areachart2.createLinearGradient(0, 0, 0, 90);
    gradient2.addColorStop(0, 'rgba(240, 61, 79, 0.75)');
    gradient2.addColorStop(0.45, 'rgba(240, 61, 79, 0.5)');
    gradient2.addColorStop(1, 'rgba(255, 193, 7, 0)');
    var myareachartCofig2 = {
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
                backgroundColor: gradient2,
                borderColor: '#f03d4f',
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
                    display: false,
                    beginAtZero: true,
                },
                x: {
                    display: false,
                }
            }
        }
    }
    var myAreaChart2 = new Chart(areachart2, myareachartCofig2);
    /* my area chart randomize */
    setInterval(function () {
        myareachartCofig2.data.datasets.forEach(function (dataset) {
            dataset.data = dataset.data.map(function () {
                return randomScalingFactor();
            });
        });
        myAreaChart2.update();
    }, 1000);


    /* lightbox gallery */
    var gallery = $('.gallery a').simpleLightbox({ navText: ['&lsaquo;', '&rsaquo;'] });

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
            title: '<h6>Main Side menu</h6>',
            description: 'All the accessible pages should go with this beautifully designed sidebar with two level collapse menu.',
            image: "assets/img/tour-guide-1.png",
            selector: '.sidebar-wrap',
            x: 94,
            y: 50,
            offx: 11,
            offy: 0,
            position: 'right',
            onSelected: false
        }, {
            title: '<h6>Search and Top menu</h6>',
            description: 'Start typing and see result UI with categories. Secondary menu helps to access all other secondary level pages.',
            image: "assets/img/tour-guide-2.png",
            selector: '#mainheaderNavbar',
            x: 50,
            y: 40,
            offx: -20,
            offy: 25,
            position: 'bottom',
            onSelected: false
        }, {
            title: '<h6>Supportive Actions</h6>',
            description: 'There are lot of actions which we thought are small but requires to access it first. Other are global actions like notification, chat. should be kept here.',
            image: "assets/img/tour-guide-3.png",
            selector: '#gofullscreen',
            x: 50,
            y: 100,
            offx: -5,
            offy: 1,
            position: 'bottom',
            onSelected: false
        }, {
            title: '<h6>Configurations at once</h6>',
            description: 'Mostly in Admin, Dashboard, Analytical app user needs to customize date range, filter data at a priority. Also you can change theme colors by clicking on palette icon.',
            image: "assets/img/tour-guide-4.png",
            selector: '#stylise',
            x: 0,
            y: 10,
            offx: -50,
            offy: 30,
            position: 'bottom',
            onSelected: false
        }]
    };
    var tour = window.ProductTourJS;
    tour.init(tourOptions);

    $('#starttour').on('click', function () {
        tour.start();
    })
});
