
var modal = document.getElementById('myModal');
var btn = document.getElementById("myVenues");
var x = document.getElementsByClassName("close");


// When the user clicks on (x), close the modal
x.onClick = function() {
    modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onClick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
