'use strict'
/* table scheduler  */
var appointmentsTable = $('.appointments-table');
var timepuchTable = $('.timepunch-table');


$(window).on('load', function () {

    var swiper = new Swiper(".swiperauto", {
        slidesPerView: "auto",
        spaceBetween: 20,
    });

    $('.swiperauto .swiper-slide').on('click', function () {
        $('.swiperauto .swiper-slide').removeClass('active')
        $(this).addClass('active')
    });

    /* header height set  */
    timepuchTable.find('thead tr th').css('height', appointmentsTable.find('thead tr th').outerHeight());


    /* click event on table cell of appointment */
    $('.appointments-table tbody tr td').on('click', function (e) {
        $('#usersname').html($(this).attr('data-title'))
        const createappointment1 = new bootstrap.Modal(document.getElementById('calendarResource'), {
        })
        createappointment1.show();
    });
    $('.appointments-table tbody tr td .card').on('click', function (e) {
        e.stopPropagation()
    })


    /* text editor tinyMCE */
    tinymce.init({
        selector: '#textareaeditor',
        menubar: false,
        toolbar_mode: 'floating',
        tinycomments_mode: 'embedded',
        plugins: 'image link autolink ',
        toolbar: 'undo redo | bold italic underline strikethrough | image link',
        branding: false,

        /* without images_upload_url set, Upload tab won't show up*/
        images_upload_url: 'postAcceptor.php',

        /* we override default upload handler to simulate successful upload*/
        images_upload_handler: function (blobInfo, success, failure) {
            setTimeout(function () {
                /* no matter what you upload, we will turn it into TinyMCE logo :)*/
                success('http://moxiecode.cachefly.net/tinymce/v9/images/logo.png');
            }, 2000);
        },
    });


});

$(window).on('resize', function () {
    /* header height set  */
    timepuchTable.find('thead tr th').css('height', appointmentsTable.find('thead tr th').outerHeight());

});

$(window).on('scroll', function () {


});
