'use strict'
$(window).on('load', function () {

    /* get date and time */
    var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    function startTime() {
        var date = new Date;
        var day = date.getDate();
        var month = monthNames[date.getMonth()];
        var year = date.getFullYear();
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        var strTime = hours + ':' + minutes;
        $('#time').text(strTime);
        $('#ampm').text(" " + ampm);
        $('#date').text(day + ' ' + month + ' ' + year);
    }
    setInterval(function () { startTime() }, 500);

    /* change images based on time zones */
    var date = new Date;
    if (date.getHours() < 12 && date.getHours() >= 7) {
        $('#image-daytime').parent().css('background-image', 'url("assets/img/bg-13.jpg")');
    } else if (date.getHours() >= 12 && date.getHours() <= 19) {
        $('#image-daytime').parent().css('background-image', 'url("assets/img/bg-3.jpg")');
    } else {
        $('#image-daytime').parent().css('background-image', 'url("assets/img/bg-12.jpg")');
    }

    /* temperature data */
    var cityname = 'London';
    $('#citychange li').on('click', function () {
        if ($(this).text() != '') {
            $('#citychange li').removeClass('active');
            $(this).addClass('active')
            cityname = $(this).text();
            dataload();
        }
    })
    dataload();
    function dataload() {
        fetch('https://api.openweathermap.org/data/2.5/weather?q=' + cityname + '&APPID=ce2008ef871845f77c7f03aafe2d54eb&units=metric')
            /* change app id= "ce2008ef871845f77c7f03aafe2d54eb" with your id create from https://openweathermap.org/api current weather data */
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                appendData(data);
            })
            .catch(function (err) {
                console.log(err);
            });
    }
    function appendData(data) {
        $('#temperature').text(data.main.temp);
        $('#city').text(data.name);
        $('#tempimage').attr('src', 'assets/img/openweather-icon/light/' + data.weather[0].icon + '@2x.png');
    }

    /* swiper sliders */
    var swiperNews = new Swiper(".news-swiper", {
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        pagination: {
            el: ".swiper-pagination",
        },
    });
    var swiperImage = new Swiper(".image-swiper", {
        effect: "fade",
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
    });

    /* input validation check*/
    $('#email').on('focusout keyup', function () {
        var field = $(this);
        var $email = this.value;
        validateEmail($email, field);
    });

    function validateEmail(email, field) {
        var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
        if (!emailReg.test(email)) {
            field.closest('.check-valid').removeClass('is-valid').next().show()
        } else {
            field.closest('.check-valid').addClass('is-valid').next().hide()
        }
    }

    $('#submitbtn').on('click', function () {
        if ($(this).closest('form').find('.check-valid').not('.is-valid').length > 0) {
            $(this).closest('form').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {
            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("password.html");
            }, 2000)
        }
    })

    $('#submitpassbtn').on('click', function () {
        if ($(this).closest('form').find('.check-valid').not('.is-valid').length > 0) {
            $(this).closest('form').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {
            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("onboarding.html");
            }, 2000)
        }
    });

    $('#submitforgetpassbtn').on('click', function () {
        if ($(this).closest('form').find('.check-valid').not('.is-valid').length > 0) {
            $(this).closest('form').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {
            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("reset-password.html");
            }, 2000)
        }
    })

    $('#submitsignup').on('click', function () {
        if ($(this).closest('form').find('.check-valid').not('.is-valid').length > 0) {
            $(this).closest('form').addClass('was-validated').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {

            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("verify.html");
            }, 2000)
        }
    })

    /* passsword strenght checker */
    $('#password1').first().keyup(function () {
        var fieldpass = $(this);
        var fieldpasswrap = $(this).closest('.check-valid');
        checkStrength(fieldpass.val(), fieldpasswrap);

        if (this.value != '') {
            $('#textpassword').html(checkStrength(fieldpass.val(), fieldpasswrap))
            fieldpass.closest('.check-valid').next('.invalid-feedback').hide();
            // $(this).closest('.check-valid').addClass('is-valid');
        } else {
            fieldpasswrap.removeClass('is-valid').next('.invalid-feedback').show().text("Please enter valid input")
            $('#checksterngthdisplay').removeClass();
        }
    });

    $('#password').each(function () {
        $(this).on('focusout keyup', function () {
            if (this.value != '') {
                $(this).closest('.check-valid').addClass('is-valid')
                $(this).closest('form').addClass('was-validated');
            } else {
                $(this).closest('.check-valid').removeClass('is-valid');
                $(this).closest('form').addClass('was-validated');
            }
        });
    })

    $('#password2').on('focusout keyup', function () {
        if ($('#password1').val() === $(this).val()) {
            $(this).closest('.check-valid').addClass('is-valid').next('.invalid-feedback').text("Please enter valid input");
            $(this).closest('form').addClass('was-validated');
        } else {
            if (this.value != '') {
                $(this).closest('.check-valid').removeClass('is-valid').next('.invalid-feedback').text("Entered password doesn't match");
            } else {
                $(this).closest('.check-valid').removeClass('is-valid').next('.invalid-feedback').text("Please enter valid input");
            }
            $(this).closest('form').addClass('was-validated');
        }
    });

    function checkStrength(password, fieldpasswrap) {
        var strength = 0;

        if (password.length < 6) {
            $('#checksterngthdisplay').removeClass().addClass('short check-strength');
            $('#textpassword').removeClass().addClass('text-secondary small');
            return 'Too short password'
        }
        if (password.length > 7) strength += 1
        // If password contains both lower and uppercase characters, increase strength value.  
        if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) strength += 1
        // If it has numbers and characters, increase strength value.  
        if (password.match(/([a-zA-Z])/) && password.match(/([0-9])/)) strength += 1
        // If it has one special character, increase strength value.  
        if (password.match(/([!,%,&,@,#,$,^,*,?,_,~])/)) strength += 1
        // If it has two special characters, increase strength value.  
        if (password.match(/(.*[!,%,&,@,#,$,^,*,?,_,~].*[!,%,&,@,#,$,^,*,?,_,~])/)) strength += 1
        // Calculated strength value, we can return messages  
        // If value is less than 2  
        if (strength < 2) {
            $('#checksterngthdisplay').removeClass().addClass('weak check-strength');
            $('#textpassword').removeClass().addClass('text-danger small');
            fieldpasswrap.removeClass('is-valid');
            return 'This is a weak';
        } else if (strength == 2) {
            $('#checksterngthdisplay').removeClass().addClass('good check-strength');
            $('#textpassword').removeClass().addClass('text-warning small');
            fieldpasswrap.removeClass('is-valid');
            return 'This just a good';
        } else {
            $('#checksterngthdisplay').removeClass().addClass('strong check-strength');
            $('#textpassword').removeClass().addClass('text-success small');
            fieldpasswrap.addClass('is-valid');
            return 'Woohoo! Its a strong';
        }
    }

    $('#resetdone').on('click', function () {
        if ($(this).closest('form').find('.check-valid').not('.is-valid').length > 0) {
            $(this).closest('form').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {
            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("thankyou1.html");
            }, 2000)
        }
    })

    $('#viewpassword').on('click', function () {
        var passInput = $(this).closest('.form-group').find('.form-control');
        if (passInput.attr('type') === 'password') {
            $(this).find('i').attr('class', 'bi-eye-slash');
            passInput.attr('type', 'text');
        } else {
            $(this).find('i').attr('class', 'bi bi-eye');
            passInput.attr('type', 'password');
        }
    });
    $('#viewpassword2').on('click', function () {
        var passInput = $(this).closest('.form-group').find('.form-control');
        if (passInput.attr('type') === 'password') {
            $(this).find('i').attr('class', 'bi-eye-slash');
            passInput.attr('type', 'text');
        } else {
            $(this).find('i').attr('class', 'bi bi-eye');
            passInput.attr('type', 'password');
        }
    })

    /* verify */
    if ($('#timer').length > 0) {
        $('#timer').innerHTML = '0' + ':' + '20';
        startTimer();
        function startTimer() {
            var presentTime = $('#timer').html();
            var timeArray = presentTime.split(/[:]+/);
            var m = timeArray[0];
            var s = checkSecond((timeArray[1] - 1));
            if (s == 59) {
                m = m - 1
            }
            if (m < 0) {
                return
            }

            $('#timer').html(m + ":" + s);
            setTimeout(startTimer, 1000);
        }
        function checkSecond(sec) {
            if (sec < 10 && sec >= 0) {
                sec = "0" + sec
            }; // add zero in front of numbers < 10
            if (sec < 0) {
                sec = "59"
            };
            return sec;
        }
    }
    $('#verifyBtn').on('click', function () {
        var OTPvalue = $('#verify1').val() + $('#verify2').val() + $('#verify3').val() + $('#verify4').val();
        console.log(OTPvalue)

        if (OTPvalue != '3752') {
            $(this).closest('form').find('.global-alert').removeClass('d-none');
            setTimeout(function () {
                $('.global-alert').addClass('d-none');
            }, 3000)
        } else {
            $(this).closest('form').find('.global-success').removeClass('d-none');
            $(this).closest('form').find('.global-alert').addClass('d-none');
            setTimeout(function () {
                window.location.replace("thankyou2.html");
            }, 2000)
        }
    });

})