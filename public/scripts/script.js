$( document ).ready(function() {

    // HOME PAGE
    // Make post requests to searches that show these favorite venues
        $('#topvenue1').click(function(){
            $( "#topvenue1" ).submit();
        })
        $('#topvenue2').click(function(){
            $( "#topvenue2" ).submit();
        })
        $('#topvenue3').click(function(){
            $( "#topvenue3" ).submit();
        })

    // MODAL ON LIST PAGE
    // When you click "x" button, closes the modal in venue list view
        $('.close').on('click', function(){
          $(".viewVenues").hide()
        })
    //When you tag a venue to an event, close the modal
        $('.taggedEvent').on('click', function(){
          alert("Great! You saved the venue!")
          $(".viewVenues").hide()
        })
    //If not loggedin, show modal requesting user log in

    // for when Most Recent Search renders nothing
        if(window.location.href.split("?")[1] === "needsearch=true"){
            alert("Please make an initial search first")
        }

    //QUOTE PAGE
    $( "#request-bids" ).click(function() {
        $( "#contactBtn" ).trigger("click");
    });



});

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
