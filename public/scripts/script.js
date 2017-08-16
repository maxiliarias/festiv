$( document ).ready(function() {

    // MODAL ON LIST PAGE
    // When you click "x" button, closes the modal in venue list view
        $('.close').on('click', function(){
          $(".viewVenues").hide()
        })
    //When you tag a venue to an event, close the modal
        $('.taggedEvent').on('click', function(){
            console.log('getting to this jquery');
          alert("Great! You saved the venue!")
          $(".viewVenues").hide()
        })

    // Confirmation for when a feedbackform is submitted
        if(window.location.href.split("?")[1] === "message=sent"){
            $("#sentMsg").modal('show')
        }

    //QUOTE PAGE
    $( "#request-bids" ).click(function() {
        $( "#contactBtn" ).trigger("click");
    });

    // $('#checkForm').click(function(){
    //     if($("#time").length === 0 || $("#price").length === 0 ){
    //         alert("Please make a selection in the dropdown boxes")
    //         return
    //     } else if ($("#otherinput").val() === ""){
    //         alert('Please fill out all required fields')
    //     }
    // })
});

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
