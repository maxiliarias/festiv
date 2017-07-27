
var modal = document.getElementsByClassName('viewVenues');
var btn = document.getElementById("myVenues");
var x = document.getElementById('closeMod');
console.log('XX is here', x)

// When the user clicks on (x), close the modal
x.onclick = function() {
    console.log('printing in onclick', modal)
    for (var i=0;i<modal.length; i++){
        modal[i].style.display = "none";
    }
}

// When the user clicks anywhere outside of the modal, close it
window.onClick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

//Do something to indicate venue has been added to a particular list
//give it a heart shape that changes color on click
