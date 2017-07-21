var express = require('express');
var router = express.Router();
var models = require('../models');
var { Message, User } = require('../models');
// var User = models.User;
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
    // console.log('session!',req.session)
    req.session.search = req.session.search || [];
    if (req.session.search.length > 0) {
        var modal = ""
        if(req.query.modal){
            modal = "display:block"
        }
        res.render('list', {
            venues: req.session.search,
            googleApi: process.env.GOOGLEPLACES,
            modal: modal
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
                    venues.push(request(`https://maps.googleapis.com/maps/api/place/details/json?key=${process.env.GOOGLEPLACES}&placeid=${placeId[i]}`)
                    .then(resp => JSON.parse(resp))
                    .then(obj2 => ({
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
                    )))
                }
                return Promise.all(venues)
            })
            .then(arrayOfResults => {
                var arr = ['bakery','grocery_or_supermarket','store','cafe','lodging']
                var filteredVenues = arrayOfResults.filter(place => {return place.type.every(function(elem){return arr.indexOf(elem) === -1})})

                req.session.search = filteredVenues;
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
    console.log('CREATE MSG POST',req)
})

///////////////////////////// END OF PUBLIC ROUTES /////////////////////////////

router.use(function(req, res, next) {
    if (!req.user) {
        res.redirect('/login');
    } else {
        return next();
    }
});

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

/* ADD TO CART adds the specifc venue to your cart */
router.post('/cart', function(req, res) {
    var venueName = req.query.name;
    var address = req.query.address;
    console.log('venuename', venueName, 'address'. address);
    User.findById(req.user._id)
        .exec(function(err, user) {
        console.log('session', req.session);
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
    res.render('contactlist');
})

/*Use Hunter API to find venue owner/business emails*/
router.get('/getemails', function(req, res) {
    User.findById(req.user._id)
        .exec(function(err, user) {
        let cart = req.user.cart
        cart.forEach(venue => {
            console.log('WEBSITESS !' , venue.website)
            var web = venue.website
            /*THE BELOW IS TO HELP HUNTER FIND EMAILS, HAVE TO DECIDE WHICH GENERATES MORE RETURNS*/
            // var subDom = web.indexOf("www.")
            // var subDom2 = web.indexOf('.')
            // var end = web.indexOf('.com')
            // var domainArea;
            // subDom === -1 ? domainArea = web.slice(subDom2 +1, end +4) : domainArea = web.slice(subDom + 4, end + 4)

            request(`https://api.hunter.io/v2/domain-search?domain=${web}&api_key=${process.env.HUNTER}&type=generic`)
            .then(resp => JSON.parse(resp))
            .then(obj => {
                console.log('HEREE !',obj.data.emails)
                //these emails are in priority order of what is likely most accurate
                let toEmail =['events@','info@','privatedining@','contact','reservations@']
                let email1;
                let email2;

                //should I move this function elsewhere?
                collectEmail= () => {
                    for (var i=0; i< toEmail.length; i++){
                        if(email2){
                            break;
                        }
                        obj.data.emails.forEach(email => {
                            if(email1){
                                if(email.value.indexOf(toEmail[i])>=0){
                                    email2 = email.value
                                }
                            } else {
                                if(email.value.indexOf(toEmail[i])>=0){
                                    email1 = email.value
                                }
                            }
                        })
                    }
                }
                collectEmail();
                console.log('sendGrid EMAIL 1', email1);
                console.log('sendGrid EMAIL 2', email2);
            })
        })
    })
    res.redirect('/')
})

/* SUBMIT CONTACTLIST we will now send an email to venues*/
router.post('/contactlist', function(req, res) {
    //Will want to loop through an array of emails to trigger sendgrid several times
    var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: {
            personalizations: [
                {
                    to: [
                        {
                        //here I want to put in the hunter emails
                        email: 'maxiliarias@gmail.com'
                        }
                    ],
                    'substitutions': {
                        '-businessName-': 'tester businesss', //should loop through cart/session for venue name
                        '-fname-': req.user.fname,
                        '-date-': req.body.date,
                        '-starttime-': req.body.starttime,
                        '-guestCount-': req.body.guestCount,
                        '-price-': req.body.price,
                        '-hours-': req.body.hours
                    },
                    subject: req.user.fname + " would like to book your venue with Festiv!",
                    custom_args: {
                        "userid": req.user._id
                    }
                }
            ],
            from: {
                email: 'hello@parse.festivspaces.com'
            },
            template_id: process.env.TEMPLATE_ID
        }
    });
    sg.API(request, function(error, response) {
        if (error) {
            console.log('Error response received');
        }
        console.log('RESPONSE', response);
        console.log('STATUS HERE' ,response.statusCode);
        console.log('BODY HERE', response.body);
        console.log('HEADERS HERE', response.headers);
        res.redirect('/refresh');
    });
})

/* RECEIVE replies to our emails, and store the messages in mongoose*/
router.post('/messages', upload.array(), function(req,res){
    simpleParser(req.body.email, function(err, mail) {
        console.log('MAIL TEXT',mail.text);
        console.log('MAIL FROM', mail.from.text);
        console.log('MAIL date', mail.date);
        var msg = new Message({
            time: mail.date,
            from: mail.from.text,
            content: mail.text
        });
        msg.save(function(err, m) {
            res.status(200).end();
        })
    })
    // message.save on mongoose
    // find all messages and pass that to hbs
    // res.render('/messages', {messages: req.body})
})

/*Render a page with all of the messages*/
router.get('/messages',function(req,res){
    Message.find(function(err,msg){
        msg.forEach((x) => {x.content = x.content.replace(/(?:\r\n|\r|\n)/g, '</br>')})
        console.log('HI',msg);
        res.render('messages', {message: msg })
    })
})


///////////////////////////// END OF PRIVATE ROUTES /////////////////////////////

module.exports = router;
