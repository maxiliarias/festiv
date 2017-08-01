$( document ).ready(function() {
    console.log( "jQuery ready!" );

    //Close modals in venue list view
    $('.close').on('click', function(){
      $(".viewVenues").hide()
    })
});
var dateBox= document.getElementById('dateBox')



var date = new Date();
date.setDate(date.getDate()-1);

dateBox.datepicker({
    startDate: date
});

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
