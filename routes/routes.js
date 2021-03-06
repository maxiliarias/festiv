var express = require('express');
var router = express.Router();
var { Blog, User, Event, VEvent, VData, Chat } = require('../models');
var { helper } = require('../helper');
var request = require('request-promise');
var fs = require('fs');
var NodeGeocoder = require('node-geocoder');
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var clearbit = require('clearbit')(process.env.CLEARBIT);
var multer  = require('multer');
var upload = multer({ dest: 'public/' });
var simpleParser = require('mailparser').simpleParser;
var fullStory = require('fullstory');
//////////////////////////////// PUBLIC ROUTES ////////////////////////////////
// Users who are not logged in can see these routes

/* HOME PAGE where you can enter your search */
router.get('/', function(req, res, next) {
    if (req.user) {
        res.render('home', {
            googleApi: process.env.GOOGLEPLACES,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user.displayName,
            user: {
                fbid: req.user.fbid,
                displayName: req.user.displayName,
                email: req.user.email,
            }
        });
    } else {
        res.render('home', {
            googleApi: process.env.GOOGLEPLACES,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false
        });
    }

});

router.get('/venues',function(req, res){
    let events;

    if (req.query.placeId) {
        var temp = JSON.parse(JSON.stringify(req.session.search));
        temp.forEach(function(venue) {
            if (venue.placeId === req.query.placeId) {
                venue.modal = "display:block";
            } else {
                venue.modal = "";
            }
        });

        Event.find({eventOwner: req.user._id})
        .populate('vEvent')
        .exec()
        .then(o => {
            events = o
            res.render('list', {
                venues: temp,
                googleApi: process.env.GOOGLEPLACES,
                events: events,
                page2: req.session.pagetoken[1] ? 'true' : null,
                page3: req.session.pagetoken[2] ? 'true' : null,
                loggedin: req.user ? true: false,
                searchSesh: req.session.search ? true : false,
                displayName: req.user ? req.user.displayName : null
            })
        })
        .catch(function(err){
            console.log('error is ', err);
            console.log('url is', req.url);
            res.redirect('/error')
        })

    } else {
        res.render('list', {
            venues: req.session.search,
            googleApi: process.env.GOOGLEPLACES,
            events: events,
            page2: req.session.pagetoken[1] ? 'true' : null,
            page3: req.session.pagetoken[2] ? 'true' : null,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null
        })
    }
})

/* Blog Routes public*/
router.get('/blog', function(req, res){
    return Blog.find()
    .then(blogs => {
        res.render('blog',{
            blog: blogs,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null,
        })
    })
    .catch(function(err){
        console.log('error is', err);
        console.log('url is', req.url);
        res.redirect('/error')
    })
})
router.get('/pumpkinflair',function(req,res){
    res.render('bloggers/pumpkinflair',{
        loggedin: req.user ? true: false,
        searchSesh: req.session.search ? true : false,
        displayName: req.user ? req.user.displayName : null})
})
router.get('/macaroonsBlooms',function(req,res){
    res.render('bloggers/macaroonsBlooms',{
        loggedin: req.user ? true: false,
        searchSesh: req.session.search ? true : false,
        displayName: req.user ? req.user.displayName : null})
})
router.get('/whiskyaficionados',function(req,res){
    res.render('bloggers/whiskyaficionados',{
        loggedin: req.user ? true: false,
        searchSesh: req.session.search ? true : false,
        displayName: req.user ? req.user.displayName : null
    })
})

/*CONTACT US Page*/
router.get('/contactus', function(req,res){
    if(req.query.message){
        res.render('contactus', {
            modal: true,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null,
        })
    } else {
        res.render('contactus', {
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null,
        })
    }
})

router.post('/contactus', function(req,res){
    var b = {
        personalizations: [{
            "to": [{
                  "email": "maxiliarias@gmail.com"
              },{
                  "email": "hello@festivspaces.com"
              }],
            subject: req.body.email + " has sent you a message",
        }],
        from: {
            email: 'alert@hello.festivspaces.com',
            name: 'Festiv'
        },
        "content": [{
              "type": "text/plain",
              "value": "from " + req.body.name + "\n" + req.body.message
            }]
    }

    var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: b
    });
    sg.API(request, function(error, response) {
        if (error) {
            console.log('Error response received');
        }
        console.log('STATUS HERE' ,response.statusCode);
        console.log('BODY HERE', response.body);
        console.log('HEADERS HERE', response.headers);
    });
    res.redirect('/contactus?message=sent')
})

// Test API function by AARON FORD
router.get('/api/venue', function(req, res) {
    return res.end(JSON.stringify({name: 'maxi'}));
})

/* VENUES creates session venues */
router.post('/venues', function(req, res) {
    var options = {
        provider: 'google',
        httpAdapter: 'https', // Default
        apiKey: process.env.GOOGLEPLACES
    };
    var geocoder = NodeGeocoder(options);
    let placeId= [];
    let venues = [];
    let lat;
    let lng;
    let keyword;

    req.session.location = req.body.location || req.session.location;
    req.body.type = req.body.type || " "
    geocoder.geocode(req.session.location)
    .then(function(response) {
        lat= response[0].latitude
        lng= response[0].longitude
    })
    .then(function() {
        req.session.keyword =  req.body.type ===" "? req.session.keyword : req.body.type.split(" ").join("_").toLowerCase();
        keyword= req.session.keyword
        req.session.pagetoken= req.session.pagetoken || [""];

        return request(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${lng}&rankby=distance&keyword=${keyword}&minprice=3`+ (parseInt(req.query.num) ? `&pagetoken=${req.session.pagetoken[req.query.num]}` : ``));
    })
    .then(resp => JSON.parse(resp))
    .then(obj => {
        console.log('REQUEST', `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${lng}&rankby=distance&keyword=${keyword}&minprice=3`+ (parseInt(req.query.num) ? `&pagetoken=${req.session.pagetoken[req.query.num]}` : ``))

        if(obj.next_page_token && req.session.pagetoken.length<= 3){
            req.session.pagetoken.push(obj.next_page_token);
        }

        obj.results.forEach(item => {
            placeId.push(item.place_id)
        });
        for (var i = 0; i < placeId.length; i++) {
            var venueId = placeId[i]
            venues.push(
                request(`https://maps.googleapis.com/maps/api/place/details/json?key=${process.env.GOOGLEPLACES}&placeid=${placeId[i]}`)
                .then(resp => JSON.parse(resp))
                .then(
                    (function(v){
                        return function(obj2) {
                            return VData.find()
                            .then(function(storedVenues){
                                for (var j=0; j< storedVenues.length; j++){
                                    if(storedVenues[j].placeId === v){
                                        return true;
                                    }
                                }
                                return false
                            })
                            .then(function(exists){
                                if(!exists){
                                    var newVen = new VData({
                                        placeId: v,
                                        name: obj2.result.name,
                                        domain: obj2.result.website
                                    })
                                    newVen.save(function(err, ven) {
                                        console.log('err is', err); // ignore
                                    });
                                }
                                return ({
                                    placeId: v,
                                    name: obj2.result.name,
                                    address: obj2.result.formatted_address,
                                    phone: obj2.result.formatted_phone_number,
                                    photo1: obj2.result.photos ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + obj2.result.photos[0].photo_reference + '&key=' + process.env.GOOGLEPLACES : '',
                                    photo2: obj2.result.photos ?   (obj2.result.photos[1] ? obj2.result.photos[1].photo_reference : "") : "",
                                    photo3: obj2.result.photos ?   (obj2.result.photos[2] ? obj2.result.photos[2].photo_reference : "") : "",
                                    photo4: obj2.result.photos ?   (obj2.result.photos[3] ? obj2.result.photos[3].photo_reference : "") : "",
                                    photo5: obj2.result.photos ?   (obj2.result.photos[4] ? obj2.result.photos[4].photo_reference : "") : "",
                                    photo6: obj2.result.photos ?   (obj2.result.photos[5] ? obj2.result.photos[5].photo_reference : "") : "",
                                    photo7: obj2.result.photos ?   (obj2.result.photos[6] ? obj2.result.photos[6].photo_reference : "") : "",
                                    photo8: obj2.result.photos ?   (obj2.result.photos[7] ? obj2.result.photos[7].photo_reference : "") : "",
                                    photo9: obj2.result.photos ?   (obj2.result.photos[8] ? obj2.result.photos[8].photo_reference : "") : "",
                                    photo10:obj2.result.photos ?   (obj2.result.photos[9] ? obj2.result.photos[9].photo_reference : "") : "",
                                    rating: obj2.result.rating,
                                    lat: obj2.result.geometry.location.lat,
                                    long: obj2.result.geometry.location.lng,
                                    hours: obj2.result.opening_hours
                                    ? obj2.result.opening_hours.weekday_text
                                    : ["Opening Hours Unavailable"],
                                    type: obj2.result.types,
                                    url: obj2.result.url,
                                    website: obj2.result.website
                                })
                            })
                        }
                    })(venueId)
                )
            )
        }
        return Promise.all(venues)
    })
    .then(arrayOfResults => {
        var arr = ['bakery','grocery_or_supermarket','store','cafe']
        var arrayOfResults = arrayOfResults.filter(place => {
            return place.type.every(function(elem){
                return arr.indexOf(elem) === -1;
            }) && place.photo5 !== "";
        });
        req.session.search = arrayOfResults;
        res.render('list', {
            venues: arrayOfResults,
            googleApi: process.env.GOOGLEPLACES,
            page2: req.session.pagetoken[1]? 'true': null,
            page3: req.session.pagetoken[2]? 'true': null,
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null
        });
    })
    .catch(function(err) {
        console.log('error is',err);
        console.log('url is', req.url);
        res.redirect('/error')
    });
})

/* NEW SEARCH goes here after search within venues is pinged*/
router.post('/newSearch', function(req, res) {
    req.session.search =[]
    req.session.pagetoken=[""]
    //307 repeats the request with the same method (here that is a post) and the
    //the same parameters (here thats the submitted req.body)
    res.redirect(307, '/venues');
})

/* INDIVIDUAL VENUE can see more information about one venue */
router.get('/venue', function(req, res) {
    let events;
    let company;

    VData.findOne({placeId: req.query.placeId})
    .then(v => {
        if(!v.clearbit){
            return clearbit.Company.find({domain: req.query.website})
            .then(function (c) {
                v.clearbit= true
                company = c;
                if(c.site.emailAddresses){
                    let toEmail=['events@','info@','privatedining@','contact@','reservations@']

                    for (var i=0; i< toEmail.length; i++){
                        if(v.clearbitEmail && v.clearbitEmail[1]){
                            break;
                        }
                        c.site.emailAddresses.forEach(email => {
                            if(email.indexOf(toEmail[i])>=0){
                                if(v.clearbitEmail && v.clearbitEmail[0]){
                                    v.clearbitEmail.push(email)
                                } else {
                                    v.clearbitEmail = [email]
                                }
                            }
                        })
                    }
                    return v.save()
                }
                return v.save();
            })
            .then(function(foundVdata){
                foundVdata.facebook = company.facebook.handle || ""
                foundVdata.twitter = company.twitter.handle || ""
                foundVdata.description = company.description || ""
                foundVdata.metaD = company.site.metaDescription || ""
                foundVdata.twitterBio = company.twitter.Bio || ""
                foundVdata.save();
                return
            })
            .catch(clearbit.Company.QueuedError, function (err) {
                // Company lookup queued - try again later
                console.log('error1', err)
                console.log('url is', req.url);
                throw err
            })
            .catch(clearbit.Company.NotFoundError, function (err) {
                // Company could not be found
                console.log('error2',err);
                console.log('url is', req.url);
                throw err
            })
            .catch(function(err){
                console.log('error is',err);
                console.log('url is', req.url);
                throw err
            })
        }
        v.save()
        return
    })
    .then(function(){
        let temp  = {
            company: company,
            placeId: req.query.placeId,
            name: req.query.name,
            address: req.query.address,
            phone: req.query.phone,
            photo1: req.query.photo1,
            photo2: helper.generateGooglePhotos(req.query.photo2),
            photo3: helper.generateGooglePhotos(req.query.photo3),
            photo4: helper.generateGooglePhotos(req.query.photo4),
            photo5: helper.generateGooglePhotos(req.query.photo5),
            photo6: helper.generateGooglePhotos(req.query.photo6),
            photo7: helper.generateGooglePhotos(req.query.photo7),
            photo8: helper.generateGooglePhotos(req.query.photo8),
            photo9: helper.generateGooglePhotos(req.query.photo9),
            photo10: helper.generateGooglePhotos(req.query.photo10),
            rating: req.query.rating,
            lat: req.query.lat,
            lng: req.query.lng,
            hours: req.query.hours.split(','),
            website: req.query.website,
        };
        if(req.user){
            Event.find({eventOwner: req.user._id})
            .populate('vEvent')
            .exec()
            .then(function(e){
                events = e;
                res.render('venue', {
                    temp:temp,
                    events: events,
                    loggedin: true,
                    searchSesh: req.session.search ? true : false,
                    displayName: req.user.displayName
                });
            })
            .catch(function (err) {
                console.error('error3 is',err);
                console.log('url is', req.url);
                throw err
            });
        } else {
            res.render('venue', {
                temp:temp,
                loggedin: false,
                searchSesh: req.session.search ? true : false,
                displayName:  null
            });
        }
    })
    .catch(function (err) {
        console.error('error4',err);
        res.redirect('/error')
    });
});

router.post('/join',function(req,res){
    var b = {
        personalizations: [{
            "to": [{
                  "email": "maxiliarias@gmail.com"
                }],
            subject: req.body.email + " has joined Festiv's contact list",
        }],
        from: {
            email: 'alert@hello.festivspaces.com',
            name: 'Festiv'
        },
        "content": [{
              "type": "text/plain",
              "value": req.body.email + " has joined Festiv's contact list. Please add to mailchimp."
            }]
    }

    var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: b
    });
    sg.API(request, function(error, response) {
        if (error) {
            console.log('Error response received');
        }
        console.log('STATUS HERE' ,response.statusCode);
        console.log('BODY HERE', response.body);
        console.log('HEADERS HERE', response.headers);
    });
    res.redirect('/')
})
/* Allows Sendgrid to post venue replies to our emails, then we store the messages
/*in mongoose and alert our client*/
router.post('/conversation', upload.any(), function(req,res){
    res.end();
    let mail;
    let attach;
    let venue;
    let foundEvent;
    let user;
    let venueId;
    let newMailSpot;

    attach=req.files

    mail = req.body
    var atSign = mail.to.indexOf("@")
    var idSpot = mail.to.indexOf("<id") + 3

    venueId= mail.to.slice(idSpot,atSign)

    VEvent.findById(venueId)
    .then(function(v) {
        venue = v;

        var temp = venue.chat
        var from = mail.envelope.indexOf('"from":')

        venue.chat = mail.text

        venue.lastFrom = mail.envelope.slice(from + 8,mail.envelope.length-2)
        venue.lastDate = helper.formatDate(new Date())
        attach.forEach(x => {
            venue.attachments.push({
                path: x.filename,
                name: x.originalname
            })
        })
        return venue.save()
    })
    .then(savedV => {
        ;
        return Event.findById(savedV.venueOption);
    })
    .then(function(fe){
        foundEvent = fe;

        return User.findById(foundEvent.eventOwner);
    })
    .then(function(u){
        user = u;
        // alert the user, they've received a response/bid
        var b = {
            personalizations: [{
                'substitutions': {
                    '-businessName-': venue.name,
                    '-link-': `http://www.festivspaces.com/messages?venueId=${venueId}`,
                    '-fname-': user.fname
                },
                "to": [{
                      "email": user.email
                    }],
                subject: "You've received a message from " + venue.name,
                custom_args: {
                    "VEventid": venue._id,
                }
            }],
            from: {
                email: 'alert@hello.festivspaces.com',
                name: 'Festiv'
            },
            template_id: process.env.TEMPLATE_ID_ALERT
        }

        var request = sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: b
        });
        sg.API(request, function(error, response) {
            if (error) {
                console.log('Error response received');
            }
            console.log('STATUS HERE' ,response.statusCode);
            console.log('BODY HERE', response.body);
            console.log('HEADERS HERE', response.headers);
        });
    })
    .catch(function(err) {
        console.log('sendgrid error', err);
    })
})

/* Router for Sendgrid to send eventLogs on email opens,clicks etc.*/
router.post('/eventlogs',function(req,res){
    res.end()
    console.log(req.body)
})
router.get('/error', function(req,res){
    res.render('error',{
        loggedin: req.user ? true: false,
        searchSesh: req.session.search ? true : false,
        displayName: req.user ? req.user.displayName : null
    })
})
///////////////////////////// END OF PUBLIC ROUTES /////////////////////////////

router.use(function(req, res, next) {
    if (!req.user) {
        req.session.url = req.url
        console.log('url is', req.session.url)
        res.redirect('/login');
    } else {
        return next();
    }
});

//////////////////////////////// PRIVATE ROUTES ////////////////////////////////
// Only logged in users can see these routes

/*Create a new event, makes a new venue, tags the venue to the event and saves to mongoose*/
router.post('/addEvent',function(req,res){
    let event;
    var newE = new Event({
        eventOwner: req.user._id,
        name: req.body.event,
    })
    return newE.save()
    .then(savedE =>{

        event = savedE
        var newVenue = new VEvent ({
            venueOption: event._id,
            placeId:req.query.placeId,
            name: req.body.name
        })
        return newVenue.save()
    })
    .then(newVen => {

        event.vEvent.push(newVen._id)
        event.save()
        if(req.body.profile){
            res.redirect('back');
        } else {
            res.redirect('/venues');
        }
    })
    .catch(function(err){
        console.log('error is ', err);
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/*Update event details*/
router.post('/updateEvent', function(req,res){
    return Event.findById(req.body.eventId)
    .then(event => {
        (req.body.name) ? event.name=req.body.name : null;
        (req.body.date) ? event.date= req.body.date: null;
        (req.body.time) ? event.time= req.body.time : null;
        (req.body.hours) ? event.hours= req.body.hours :null;
        (req.body.guestCount) ? event.guestCount= req.body.guestCount : null;
        (req.body.price) ? event.price= req.body.price : null;

        event.save()

        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* ADDS A VENUE TO AN EXISTING EVENT */
router.get('/addVenue',function(req,res){
    let eventId=req.query.eventId;
    let placeId=req.query.placeId;
    let name=req.query.name;
    let newVen;
    //If that venue already exists under that eventId, DON'T CREATE A NEW VENUEID
    //Do a Venue.find(venueOption=eventid) to find all of the venues under that event umbrella
    return VEvent.find({venueOption: eventId})
    .then(venues => {
        if (!venues || venues.length <= 0) {
            return false;
        }
        for(var i = 0; i < venues.length; i++) {
            if (venues[i].placeId === placeId) {
                return true;
            }
        }
        return false;
    })
    .then(exists => {
        if (!exists) {
            var newVenue = new VEvent({
                venueOption:eventId,
                placeId:placeId,
                name:name
            })
            return newVenue.save()
            .then(nV => {
                newVen=nV
                return Event.findById(eventId)
            })
            .then(event => {
                event.vEvent.push(newVen._id)
                event.save()
                if(req.query.profile){
                    res.redirect('back');
                } else{
                    res.redirect('/venues')
                }
            })
            .catch(function(err){
                console.log('error is', err);
                console.log('url is', req.url);
                throw err
            })
        } else {
            if(req.query.profile){
                res.redirect('back');
            } else{
                res.redirect('/venues')
            }
        }
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* SHOW all EVENTS related to that particular user*/
router.get('/events', function(req, res) {
    Event.find({eventOwner:req.user._id})
    .populate('vEvent')
    .exec()
    .then(events => {
        res.render('events',({
            events: events,
            min: helper.formatDate(new Date()),
            loggedin: req.user ? true: false,
            searchSesh: req.session.search ? true : false,
            displayName: req.user ? req.user.displayName : null
        }))
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* REMOVE a specific event from the database*/
router.get('/removeEvent', function(req, res) {
    var eventId= req.query.eventId;
    return VEvent.find({venueOption: eventId})
    .then(venueArr => {
        venueArr.map(venue => {
            Chat.find({chatOwner: venue._id})
            .then( msgArr => {
                msgArr.map( msg => {
                    msg.remove()
                })
            })
            .then( () => {
                venue.remove()
            })
            .catch(function(err){
                console.log('err is', err);
                console.log('url is', req.url);
                throw err
            })
        })
    })
    .then( () => {
        return Event.findById(eventId)
    })
    .then(event => {
        event.remove()
        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* REMOVE a specific venue from an event*/
router.get('/removeVenue', function(req, res) {
    var vEventId= req.query.vEventId
    var eventId=req.query.eventid
    return Event.findById(eventId)
    .then(event => {
        for (var i=0; i<event.vEvent.length; i++){
            if(event.vEvent[i] == vEventId){
                event.vEvent.splice(i,1)
            }
        }
        return event.save()
    })
    .then(() => {
        Chat.find({chatOwner: vEventId})
        .then( msgArr => {
            msgArr.map( msg => {
                msg.remove()
            })
        })
        .catch(function(err){
            console.log('error is', err);
            console.log('url is', req.url);
            throw err
        })
    })
    .then (() => {
        return VEvent.findById(vEventId)
    })
    .then(venue => {
        venue.remove()
        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* QUOTELIST is the link to the questionnaire*/
router.get('/quotelist', function(req, res, next) {
    if(req.query.eventId){
        return Event.findById(req.query.eventId)
        .populate("vEvent")
        .exec()
        .then(party => {
            res.render('quotelist', ({
                party: party,
                events: false,
                min: helper.formatDate(new Date()),
                email: req.user.email ? req.user.email: "Your Email",
                fname: req.user.fname ? req.user.fname : "Your First Name",
                lname: req.user.lname ? req.user.lname : "Your Last Name",
                loggedin: req.user ? true: false,
                searchSesh: req.session.search ? true : false,
                displayName: req.user ? req.user.displayName : null
            }))
        })
        .catch(function(err){
            console.log("error is", err)
            res.redirect('/error')
        })
    } else {
        return Event.find({eventOwner:req.user._id})
        .then(ocassions =>{
            res.render('quotelist', ({
                events: ocassions,
                loggedin: req.user ? true: false,
                searchSesh: req.session.search ? true : false,
                displayName: req.user ? req.user.displayName : null
            }))
        })
        .catch(function(err){
            console.log('error is', err)
            console.log('url is', req.url);
            res.redirect('/error')
        })
    }
})

/* SUBMIT QUOTELIST we will now send an email to venues*/
router.post('/quotelist', function(req, res) {
    //if Form fields are not empty
    if(req.body.fname || req.body.lname || req.body.email || req.body.date || req.body.time || req.body.hours || req.body.guestCount || req.body.price){
        var eventId=req.query.eventId
        let fname = req.body.fname
        let lname = req.body.lname
        let email = req.body.email
        let date=req.body.date
        let time=req.body.time
        let hours=req.body.hours
        let guestCount=req.body.guestCount
        let price=req.body.price
        let additional=req.body.more

        let v;
        return User.findOne({fbid: req.user.fbid})
        .then(u => {
            u.fname = fname
            u.lname = lname
            u.email = email

            return u.save()
        })
        .then((u) => {
            console.log("user is ", u);
            return Event.findById(eventId)
        })
        .then(event => {
            event.date = date
            event.time = time
            event.hours = hours
            event.guestCount = guestCount
            event.price = price
            event.additional = additional

            return event.save()
        })
        .then(savedEvent => {
            return VEvent.find({venueOption: eventId})
        })
        .then(venues => {
            var x = venues.map(venue => {
                v = venue
                return VData.findOne({placeId:venue.placeId})
                .then(match => {
                    var web = match.domain
                // Check database to see if there's an email for that venue already
                // if not, retrieve email using hunter
                    if(match.email.length === 0){
                        console.log('no match.email', match)
                        helper.collectEmail(web)
                        .then((emails) => {
                            console.log('RETRIEVED EMAILS', emails)
                            //STORE THE EMAILS IN THE DATABASE

                            if (emails[0]){
                                match.email.push(emails[0])
                            }
                            if(emails[1]){
                                match.email.push(emails[1])
                            }

                            return match.save()
                        })
                        .then(savedV => {
                            console.log('Successfully saved venue w emails')
                            helper.sendMail(req, match, v,fname)
                        })
                        .catch(function(err){
                            console.log('error is', err);
                            console.log('url is', req.url);
                            throw err
                        })
                    }
                    else{
                        console.log('MATCH IS', match)
                        helper.sendMail(req, match, v,fname)
                    }
                })
                .catch(function(err){
                    console.log('error is', err);
                    console.log('url is', req.url);
                    throw err
                })
            })
            return Promise.all(x)
        })
        .then(() => {
            res.redirect('/nextsteps')
        })
        .catch(function(err){
            console.log('error is', err);
            console.log('url is', req.url);
            res.redirect('/error')
        })
    } else {
        res.redirect(`/quotelist?eventId=${req.query.eventId}&field=required`)
    }

})

router.get('/nextsteps',function(req,res){
    res.render('nextsteps',{
        loggedin: req.user ? true: false,
        searchSesh: req.session.search ? true : false,
        displayName: req.user ? req.user.displayName : null
    })
})

/*Render a page with the conversation for one venue*/
router.get('/messages',function(req,res){
    Event.find({eventOwner: req.user._id})
    .populate('vEvent')
    .exec()
    .then(events => {
        var venueId=req.query.venueId
        if(venueId){
            return VEvent.findById(venueId)
            .then(v => {
                if(v.chat){
                    v.chat = v.chat.replace(/(?:\r\n|\r|\n)/g, '</br>')
                }
                return v.save()
            })
            .then( newV => {
                res.render('messages', {
                    events: events,
                    message: newV.chat,
                    vEvent: newV,
                    venueId: venueId,
                    loggedin: req.user ? true: false,
                    searchSesh: req.session.search ? true : false,
                    displayName: req.user ? req.user.displayName : null
                })
            })
            .catch(function(err){
                console.log('error is', err);
                console.log('url is', req.url);
                throw err
            })
        } else {
            res.render('messages', {
                events: events,
                loggedin: req.user ? true: false,
                searchSesh: req.session.search ? true : false,
                displayName: req.user ? req.user.displayName : null
            })
        }
    })
    .catch(function(err){
        console.log('error is', err)
        console.log('url is', req.url);
        res.redirect('/error')
    })
})

/* Save user's email, send the email to last person to respond */
/* or to official business email on file if other is not available */
router.post('/msgresponse',function(req,res){
    let venue;
    let msg;
    var venueId= req.query.venueId

    VEvent.findById(venueId)
    .then(v => {
        venue = v

        venue.chat = `${req.body.response}\n\n${req.user.fname} ${req.user.lname}\n\nOn ${venue.lastDate} ${venue.lastFrom} wrote:\n\n` + venue.chat
        venue.save()
    })
    .then(() => {
        return VData.findOne({placeId: venue.placeId})
    })
    .then(vSource => {
        var b={
            "personalizations": [{
                //Send email to the last person to respond or the original email it was sent to
                // if no response from the business yet
                  "to": [{
                      "email": venue.lastFrom || vSource.email[0]
                    }],
                    subject: req.body.subject,
                    custom_args: {
                        "vEventid": venueId
                    }
            }],
            "from": {
                email: req.user.fname + '@reply.festivspaces.com',
                name: req.user.fname + ' (Festiv)'
            },
            "content": [{
                  "type": "text/plain",
                  "value": venue.chat.replace(/(<([^>]+)>)/g, "\n")
              }],
            reply_to:{
                  email: 'id'+ venueId + '@reply.festivspaces.com',
                  name: req.user.fname + ' (Festiv)'
              },
            }
        var request = sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: b
        });

        sg.API(request, function(error, response) {
            if (error) {
                console.log('Error response received');
                console.log('url is', req.url);
            }
            console.log('RESPONSE', response);
            console.log('STATUS HERE' ,response.statusCode);
            console.log('BODY HERE', response.body);
        });
        res.redirect(`/messages?venueId=${venueId}`)
    })
    .catch(function(err){
        console.log('error is', err);
        console.log('url is', req.url);
        res.redirect('/error')
    })
})
///////////////////////////// END OF PRIVATE ROUTES /////////////////////////////

module.exports = router;
