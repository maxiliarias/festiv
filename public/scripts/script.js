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

    if(window.location.href.split("?")[1] === "needsearch=true"){
        alert("Please make an initial search")
    }

    // $('#venueLink').on('click', function(){
    //     console.log('in here');
    //
    //     if(!req.session.search){
    //         alert("Please make an initial search")
    //     }
    // })

});

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
