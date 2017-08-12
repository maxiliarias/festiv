$( document ).ready(function() {
    console.log( "jQuery ready!" );

    //When you click "x" button, closes the modal in venue list view
    $('.close').on('click', function(){
      $(".viewVenues").hide()
    })
    //When you tag a venue to an event, close the modal
    $('.taggedEvent').on('click', function(){
      $(".viewVenues").hide()
    })
    // for when venues renders nothing
    if(window.location.href.split("?")[1] === "needsearch=true"){
        alert("Please make a new search first")
    }

    $( "#request-bids" ).click(function() {
        $( "#contactBtn" ).trigger("click");
    });

    // Make post requests to these searches
    $('#topvenue1').click(function(){
        $( "#topvenue1" ).submit();
    })
    $('#topvenue2').click(function(){
        $( "#topvenue2" ).submit();
    })
    $('#topvenue3').click(function(){
        $( "#topvenue3" ).submit();
    })

});

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
