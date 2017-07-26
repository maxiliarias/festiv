var express = require('express');
var router = express.Router();
var models = require('../models');
var {User, Event, Venue, Chat } = require('../models');
var {helper} = require('../helper');
var request = require('request-promise');
var fs = require('fs');
var NodeGeocoder = require('node-geocoder');
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var multer  = require('multer');
var upload = multer();
const simpleParser = require('mailparser').simpleParser;

//////////////////////////////// PUBLIC ROUTES ////////////////////////////////
// Users who are not logged in can see these routes

/* HOME PAGE where you can enter your search */
router.get('/', function(req, res, next) {

    req.session.search = req.session.search || [];
    if (req.session.search.length > 0) {
        var events;
        Event.find({eventOwner: req.user._id})
            .populate('venue')
            .exec(function(err,ocassions){
            events = ocassions
        // assumption, i have req.query.placeId
            var temp = JSON.parse(JSON.stringify(req.session.search));
            temp.forEach(function(venue) {
                if (venue.placeId === req.query.placeId) {
                    venue.modal = "display:block";
                } else {
                    venue.modal = "";
                }
            });
            res.render('list', {
                venues: temp,
                googleApi: process.env.GOOGLEPLACES,
                events: events
            })
        })
    } else {
        res.render('home', {
            googleApi: process.env.GOOGLEPLACES
        });
    }
});

/* VENUES creates session venues */
router.post('/venues', function(req, res) {
    if (req.session.search && req.session.search.length > 0 && req.session.pagetoken === "") {
        res.render('list', {
            venues: req.session.search,
            googleApi: process.env.GOOGLEPLACES
        })
    } else {
        var options = {
            provider: 'google',
            httpAdapter: 'https', // Default
            apiKey: process.env.GOOGLEPLACES
        };
        var geocoder = NodeGeocoder(options);
        let placeId= [];
        let venues = [];
        let lat;
        let long;

        //need this dummy address and type for the next page button
        req.body.location = req.body.location || "310 West 99 Street New York,NY 10025";
        req.body.type = req.body.type || " "
        geocoder.geocode(req.body.location)
        .then(function(response) {
            lat = response[0].latitude;
            long = response[0].longitude;
        })
        .then(function() {
            let radius = parseInt(req.body.radius) * 1609.34;
            let type = req.body.type.split(" ").join("_").toLowerCase();

            return request(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${long}&radius=${radius}&keyword=${type}&minprice=3`+ (req.session.pagetoken ? `&pagetoken=${req.session.pagetoken}` : ``))
            .then(resp => JSON.parse(resp))
            .then(obj => {
                obj.next_page_token ? req.session.pagetoken = obj.next_page_token : ""
                obj.results.forEach(item => {
                    placeId.push(item.place_id)
                });
                for (var i = 0; i < placeId.length; i++) {
                    var venueId= placeId[i]
                    console.log('venueId are', venueId)
                    venues.push(request(`https://maps.googleapis.com/maps/api/place/details/json?key=${process.env.GOOGLEPLACES}&placeid=${placeId[i]}`)
                    .then(resp => JSON.parse(resp))
                    .then(
                        (function(v){
                            return function(obj2) {
                                console.log('venue:', v);
                                return {
                                    placeId: v,
                                    name: obj2.result.name,
                                    address: obj2.result.formatted_address,
                                    phone: obj2.result.formatted_phone_number,
                                    photos: obj2.result.photos,
                                    rating: obj2.result.rating,
                                    lat: obj2.result.geometry.location.lat,
                                    long: obj2.result.geometry.location.lng,
                                    hours: obj2.result.opening_hours
                                    ? obj2.result.opening_hours.weekday_text
                                    : ["Opening Hours Unavailable"],
                                    type: obj2.result.types,
                                    url: obj2.result.url,
                                    website: obj2.result.website,
                                    link: obj2.result.photos
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + obj2.result.photos[0].photo_reference + '&key=' + process.env.GOOGLEPLACES
                                    : ''
                                }
                            }
                        })(venueId)
                    ))
                }
                return Promise.all(venues)
            })
            .then(arrayOfResults => {
                var arr = ['bakery','grocery_or_supermarket','store','cafe','lodging']
                var filteredVenues = arrayOfResults.filter(place => {return place.type.every(function(elem){return arr.indexOf(elem) === -1})})

                req.session.search = filteredVenues;
                console.log('HEREEE', filteredVenues);
                res.render('list', {
                    venues: filteredVenues,
                    googleApi: process.env.GOOGLEPLACES
                });
            })
            .catch(err => console.log("ERR", err))
        })
        .catch(function(err) {
            console.log(err);
        });
    }
})

/*Receive user id and venue names from Event API and create new Message in Mongoose for user */
router.post('/createMsg',function(req,res){
    console.log('CREATE MSG POST',req.body);
    var userId = req.body.userid
    User.findById(userId,function(req,res){

    })
    res.send('OK')
})

///////////////////////////// END OF PUBLIC ROUTES /////////////////////////////

// router.use(function(req, res, next) {
//     if (!req.user) {
//         res.redirect('/login');
//     } else {
//         return next();
//     }
// });

//////////////////////////////// PRIVATE ROUTES ////////////////////////////////
// Only logged in users can see these routes

/* REFRESH allows you to restart your search */
router.get('/refresh', function(req, res) {
    delete req.session.search;
    delete req.session.pagetoken;
    res.redirect('/');
})

/* NEW SEARCH goes here after search within venues is pinged*/
router.post('/newSearch', function(req, res) {
    delete req.session.search;
    res.redirect(307, '/venues');
})

/* INDIVIDUAL VENUE can see more information about one venue */
router.get('/venue', function(req, res) {
    var venueName = req.query.name;
    var address = req.query.address;
    req.session.search.forEach(venue => {
        if (venue.name === venueName && venue.address === address) {
            res.render('venue', {venue});
        }
    })
})

/*Create a new event, makes a new venue, tags the venue to the event and saves to mongoose*/
router.post('/addEvent',function(req,res){
    console.log('user id is', typeof req.user._id);
    console.log('name',req.body.event);
    console.log('venue id', typeof req.query.placeId);
    var event = new Event({
        eventOwner: req.user._id,
        name: req.body.event,
    })

    event.save(function(err,event){
        if(err){
            console.log("Error saving the new event", err)
        } else {
            console.log("Successfully saved the event")
            var newVenue = new Venue ({
                venueOption: event._id,
                placeId:req.query.placeId,
                domain: req.body.domain,
                name: req.body.name
            })
            newVenue.save(function(err,newVen){
                if(err){
                    console.log("Error saving the new venue",err);
                } else {
                    console.log("Successfully saved the venue")
                    res.redirect('/');
                }
            })

        }
    })
})

/*This creates and saves a new venue with the eventowner id */
router.get('/modifyEvent',function(req,res){
    //Make this a toggle where it adds or removes the venue
    var eventId=req.query.eventId;
    var venueId=req.query.venueId;
    var domain=req.query.dom;
    var name=req.query.name;
    console.log('EVENTID',eventId)
    console.log('VENUEID',venueId)
    console.log('DOMAIN',domain);
    console.log('Name',name)
    //If that venue already exists under that eventId, DON'T CREATE A NEW VENUEID
    //Do a Venue.find(venueOption=eventid) to find all of the venues under that event umbrella
    Venue.find({venueOption: eventId})
    .then(function(venues) {
        if (!venues || venues.length <= 0) {
            return false;
        }
        for(var i = 0; i < venues.length; i++) {
            if (venues[i].placeId === venueId) {
                // maybe here remove the venue if its a toggle
                return true;
            }
        }
        return false;
    })
    .then(function(exists) {
        if (!exists) {
            var newVenue = new Venue({
                venueOption:eventId,
                placeId:venueId,
                domain:domain,
                name:name
            })
            newVenue.save(function(e, saved) {
                console.log('saved',saved)
                res.redirect('/');
            });
            Venue.find({venueOption: eventId},function(err,venues){
                console.log('apples', venues)
            })
        } else {
            res.redirect('/');
        }
    })
})

/* ADD TO CART adds the specifc venue to your cart */
router.post('/cart', function(req, res) {
    var venueName = req.query.name;
    var address = req.query.address;
    console.log('venuename', venueName, 'address'. address);
    User.findById(req.user._id)
    .exec(function(err, user) {
        req.session.search.forEach(venue => {
            if (venue.name === venueName && venue.address === address) {
                var cart = user.cart;
                let exists = false
                if(cart.length >0){
                    cart.forEach(item => {
                        if(item.name === venueName && item.address === address){
                            exists= true
                        }
                    })
                }
                if(exists){
                    // var string = encodeURIComponent('This venue is already on your contact list');
                    res.redirect('/?modal=true');// + string);
                } else {
                    user.cart.push(venue)
                    user.save(function(err, savedCart) {
                        res.render('cart', {venues: user.cart});
                    })

                }
            }
        })
    })
})

/* SHOW CART shows all items in cart*/
router.get('/showCart', function(req, res) {
    User.findById(req.user._id)
    .exec(function(err, user) {
        res.render('cart', {venues: user.cart})
    })
})

/* REMOVE a specific venue from the cart*/
router.post('/remove', function(req, res) {
    var venueName = req.query.name;
    var address = req.query.address;
    User.findById(req.user._id)
    .exec(function(err, user) {
        let index;
        let cart= user.cart
        cart.forEach((venueObj, i) => {
            if (venueObj.name === venueName && venueObj.address === address) {
                index = i;
            }
        })
        cart.splice(index, 1);
        user.save(function(error, savedUser) {
            res.redirect('/showCart');
        })
    })
})


/* CONTACTLIST is the link to the questionnaire*/
router.get('/contactlist', function(req, res, next) {
    Event.find({eventOwner:req.user._id},function(err,ocassions){
        res.render('contactlist', ({events: ocassions}))
    })
})

/* SUBMIT CONTACTLIST we will now send an email to venues*/
router.post('/contactlist', function(req, res) {
    var eventId=req.body.eventId
    Event.findById(eventId, function(err,event){
        event.date=req.body.date
        event.time=req.body.starttime
        event.hours=req.body.hours
        event.guestCount=req.body.guestCount
        event.price=req.body.price

        event.save(function(err,savedEvent){
            if(err){
                console.log('Error saving event paramaters', err );
            } else {
                console.log('Successfully saved event parameters');
                Venue.find({venueOption: eventId},function(err,venues){
                    console.log('VENUES FOR THAT EVENT',venues)
                    venues.forEach(venue => {
                        var web = venue.domain
                        var b;
                        console.log('THE VENUE',venue)
                        console.log('WEBSITE', web);
                        // Check database to see if there's an email for that venue already
                        //if not, retrieve email using hunter
                        if(!venue.email){
                            // helper.collectEmail(web)
                            // .then((emails) => {
                            //     console.log('RETRIEVED EMAILS', emails)
                            //     //STORE THE EMAILS IN THE DATABASE
                            //
                            //     if (emails[0]){
                            //         venue.email.push(emails[0])
                            //     }
                            //     if(emails[1]){
                            //         venue.email.push(emails[1])
                            //     }
                            //
                            //     venue.save(function(err,savedV){
                            //         if(err){
                            //             console.log('error saving venue email', err)
                            //         } else {
                            //             console.log('Successfully saved venue w emails')
                            //             helper.sendMail(req, venue)
                            //         }
                            //     })
                            // })
                            console.log('bananas')
                        }
                        else{
                            helper.sendMail(req, venue)
                        }
                    })
                })
                res.redirect('/contactlist')
            }
        })
    })
})

/* RECEIVE replies to our emails, and store the messages in mongoose*/
router.post('/messages', upload.array(), function(req,res){
    simpleParser(req.body.email, function(err, mail) {
        console.log('MAIL To', mail.to.text);
        console.log('MAIL TEXT',mail.text);
        console.log('MAIL FROM', mail.from.text);
        console.log('MAIL date', mail.date);
        var atSign= mail.to.text.indexOf("@")
        var idSpot= mail.to.text.indexOf("<id") + 3
        console.log('MANGO',mail.to.text.slice(2,atSign))
        var chat = new Chat({
            chatOwner: mail.to.text.slice(idSpot,atSign),
            date: mail.date,
            from: mail.from.text,
            content: mail.text
        });
        console.log('BANANAS',chat)
        chat.save(function(err, chat) {
            if(err){
                console.log('Error saving the chat',err);
            } else {
                console.log('saved the chat!');
                res.status(200).end();
            }
        })
    })
})

/*Render a page with all of the messages*/
router.get('/messages',function(req,res){
    var venueId=req.query.venueId
    Chat.find({chatOwner:venueId},function(err,msg){
        if(err){
            console.log('error find a chat with that venue id', err)
        } else {
            msg.forEach((x) => {x.content = x.content.replace(/(?:\r\n|\r|\n)/g, '</br>')})
            console.log('HI',msg);
            res.render('messages', {message: msg })
        }
    })
})


///////////////////////////// END OF PRIVATE ROUTES /////////////////////////////

module.exports = router;
