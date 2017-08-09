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
var upload = multer();
var simpleParser = require('mailparser').simpleParser;

//////////////////////////////// PUBLIC ROUTES ////////////////////////////////
// Users who are not logged in can see these routes

/* HOME PAGE where you can enter your search */
router.get('/', function(req, res, next) {
    delete req.session.search
    delete req.session.pagetoken
    console.log('second', req.session.search);
    console.log('pagetoken', req.session.pagetoken);

    res.render('home', {
        googleApi: process.env.GOOGLEPLACES,
        loggedin: req.user ? true: false
    });
});

router.get('/venues',function(req, res){
    if (!req.session.search){
        res.redirect('/?needsearch=true')
        return;
    }
    Event.find({eventOwner: req.user._id})
    .populate('vEvent')
    .exec()
    .then(ocassions => {
        if (req.query.placeId) {
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
                events: ocassions,
                page2: req.session.pagetoken[1] ? 'true' : null,
                page3: req.session.pagetoken[2] ? 'true' : null,
                loggedin: req.user ? true: false
            })
        } else {
            res.render('list', {
                venues: req.session.search,
                googleApi: process.env.GOOGLEPLACES,
                page2: req.session.pagetoken[1] ? 'true' : null,
                page3: req.session.pagetoken[2] ? 'true' : null,
                loggedin: req.user ? true: false
            })
        }
    })
    .catch(function(err){
        console.log('error is ', err);
        res.redirect('/error')
    })
})

/* Blog Routes public*/
router.get('/blog', function(req, res){
    return Blog.find()
    .then(blogs => {
        res.render('blog',{
            blog: blogs,
            loggedin: req.user ? true: false
        })
    })
    .catch(function(err){
        console.log('error is', err);
        res.redirect('/error')
    })
})
router.get('/pumpkinflair',function(req,res){
    res.render('bloggers/pumpkinflair',{loggedin: req.user ? true: false})
})
router.get('/macaroonsBlooms',function(req,res){
    res.render('bloggers/macaroonsBlooms',{loggedin: req.user ? true: false})
})
router.get('/whiskyaficionados',function(req,res){
    res.render('bloggers/whiskyaficionados',{loggedin: req.user ? true: false})
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
        // let radius = (parseInt(req.body.radius) * 1609.34).toString();
        req.session.keyword =  req.body.type ===" "? req.session.keyword : req.body.type.split(" ").join("_").toLowerCase();
        keyword= req.session.keyword
        req.session.pagetoken= req.session.pagetoken || [""];
        return request(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${lng}&rankby=distance&keyword=${keyword}&minprice=3`+ (parseInt(req.query.num) ? `&pagetoken=${req.session.pagetoken[req.query.num]}` : ``));
    })
    .then(resp => JSON.parse(resp))
    .then(obj => {
        console.log('REQUEST', `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${lng}&rankby=distance&keyword=${keyword}&minprice=3`+ (parseInt(req.query.num) ? `&pagetoken=${req.session.pagetoken[req.query.num]}` : ``))
        console.log('pagetoken before', req.session.pagetoken);
        if(obj.next_page_token && req.session.pagetoken.length<= 3){
            req.session.pagetoken.push(obj.next_page_token);
        }
        console.log('page token after', req.session.pagetoken);
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
                                        console.log('found vdata');
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
                                        console.log(err); // ignore
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
        var arr = ['bakery','grocery_or_supermarket','store','cafe','lodging']
        var arrayOfResults = arrayOfResults.filter(place => {
            // do not do
            // return
            // place.type....on separate lines
            return place.type.every(function(elem){
                return arr.indexOf(elem) === -1;
            }) && place.photo5 !== "";
        });
        console.log(arrayOfResults.length-arrayOfResults.length, ' # of venues removed')
        req.session.search = arrayOfResults;
        console.log('session saved', req.session.search[0].name);
        res.render('list', {
            venues: arrayOfResults,
            googleApi: process.env.GOOGLEPLACES,
            page2: req.session.pagetoken[1]? 'true': null,
            page3: req.session.pagetoken[2]? 'true': null,
            loggedin: req.user ? true: false
        });
    })
    .catch(function(err) {
        console.log('error is',err);
        res.redirect('/error')
    });
})

/* NEW SEARCH goes here after search within venues is pinged*/
router.post('/newSearch', function(req, res) {
    req.session.search =[]
    req.session.pagetoken=[""]
    console.log('clear pg token', req.session.pagetoken);
    //307 repeats the request with the same method (here that is a post) and the
    //the same parameters (here thats the submitted req.body)
    res.redirect(307, '/venues');
})

/* INDIVIDUAL VENUE can see more information about one venue */
router.post('/venue', function(req, res) {
    let events;
    let company;
    Event.find({eventOwner: req.user._id})
    .populate('vEvent')
    .exec()
    .then(function(e){
        console.log('MY EVENTS', e)
        events = e;
        return clearbit.Company.find({domain: req.body.website});
    })
    .then(function (c) {
        console.log('inside clearbit ', c);
        company = c;
        if(c.site.emailAddresses){
            return VData.findOne({placeId: req.body.placeId})
            .then(v => {
                console.log('v is ', v);
                let toEmail=['events@','info@','privatedining@','contact@','reservations@']

                for (var i=0; i< toEmail.length; i++){
                    if(v.clearbitEmail && v.clearbitEmail[1]){
                        break;
                    }
                    c.site.emailAddresses.forEach(email => {
                        if(email.indexOf(toEmail[i])>=0){
                            if(v.clearbitEmail && v.clearbitEmail[0]){
                                console.log('inside here second email');
                                v.clearbitEmail.push(email)
                            } else {
                                v.clearbitEmail = [email]
                            }
                        }
                    })
                }
                v.save()
                return VData.findOne({placeId: req.body.placeId});
            })
        }
        return VData.findOne({placeId: req.body.placeId});
    })
    .then(function(foundVdata){
        console.log('foundVdata is', foundVdata);
        foundVdata.facebook = company.facebook.handle || ""
        foundVdata.twitter = company.twitter.handle || ""
        foundVdata.description= company.description || ""
        foundVdata.metaD= company.site.metaDescription || ""
        foundVdata.twitterBio= company.twitter.Bio || ""
        console.log('found VData, updating', foundVdata);
        return foundVdata.save();
    })
    .then(function(savedVdata){
        console.log('Successfully saved VData, now rendering venues.hbs');
        req.session.venueRedirect = {
            company: company,
            events: events,
            placeId: req.body.placeId,
            name: req.query.name,
            address: req.query.address,
            phone: req.body.phone,
            photo1: req.body.photo1,
            photo2: helper.generateGooglePhotos(req.body.photo2),
            photo3: helper.generateGooglePhotos(req.body.photo3),
            photo4: helper.generateGooglePhotos(req.body.photo4),
            photo5: helper.generateGooglePhotos(req.body.photo5),
            photo6: helper.generateGooglePhotos(req.body.photo6),
            photo7: helper.generateGooglePhotos(req.body.photo7),
            photo8: helper.generateGooglePhotos(req.body.photo8),
            photo9: helper.generateGooglePhotos(req.body.photo9),
            photo10: helper.generateGooglePhotos(req.body.photo10),
            rating: req.body.rating,
            lat: req.body.lat,
            lng: req.body.lng,
            hours: req.body.hours.split(','),
            url: req.body.url, //
            website: req.body.website,
            loggedin: req.user ? true: false
        };
        res.redirect('/venue')
    })
    .catch(clearbit.Company.QueuedError, function (err) {
        // Company lookup queued - try again later
        res.redirect('/error')
    })
    .catch(clearbit.Company.NotFoundError, function (err) {
        // Company could not be found
        console.log(err);
        res.redirect('/error')
    })
    .catch(function (err) {
        console.error(err);
        res.redirect('/error')
    });
});

router.get('/venue', function(req, res) {
    var temp = req.session.venueRedirect;
    if (!temp) {
        res.redirect('/venues');
        return;
    }
    res.render('venue', {
        temp:temp,
        loggedin: req.user ? true: false });
})

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
router.post('/messages', upload.array(), function(req,res){
    let msg;
    let venue;
    let foundEvent;
    let user;
    let venueId;
    let newMailSpot;

    simpleParser(req.body.email, function(err, mail) {
        console.log('MAIL To', mail.to.text);
        console.log('MAIL TEXT',mail.text);
        console.log('MAIL FROM', mail.from.text);
        console.log('MAIL attachments', mail.attachments);
        var atSign = mail.to.text.indexOf("@")
        var idSpot = mail.to.text.indexOf("<id") + 3
        console.log('venue id slice is',mail.to.text.slice(idSpot,atSign))
        venueId= mail.to.text.slice(idSpot,atSign)

        VEvent.findById(venueId)
        .then(function(v) {
            venue = v;
            console.log("entire venue is",venue);
            // var temp = venue.chat
            // console.log('FIRST venue chat is', temp);
            // venue.chat = mail.text + temp
            // venue.lastFrom = mail.from.text
            // venue.lastDate = helper.formatDate(mail.date)
            // console.log('SECOND venue chat now is', venue.chat);
            return venue.save()
        })
        // .then(savedV => {
        //     console.log('venue with chat is', savedV);
        //     return Event.findById(savedV.venueOption);
        // })
        // .then(function(fe){
        //     foundEvent = fe;
        //     console.log("Event is", foundEvent);
        //     return User.findById(foundEvent.eventOwner);
        // })
        // .then(function(u){
        //     user = u;
        //     console.log('User is', user);
        //     // venue.chat.push(msg._id)
        // })
        .then(function(savedV) {
            console.log('saved the venue w chat id!')
            // alert the user, they've received a response/bid
            // var b = {
            //     personalizations: [{
            //         'substitutions': {
            //             '-businessName-': venue.name,
            //             '-link-': `https://nameless-reef-77538.herokuapp.com/messages?venueId=${venueId}`,
            //             '-fname-': user.fname
            //         },
            //         "to": [{
            //               "email": user.email
            //             }],
            //         subject: "You've received a message from " + venue.name,
            //         custom_args: {
            //             "VEventid": venue._id,
            //         }
            //     }],
            //     from: {
            //         email: 'alert@hello.festivspaces.com',
            //         name: 'Festiv'
            //     },
            //     template_id: process.env.TEMPLATE_ID_ALERT
            // }
            //
            // var request = sg.emptyRequest({
            //     method: 'POST',
            //     path: '/v3/mail/send',
            //     body: b
            // });
            // sg.API(request, function(error, response) {
            //     if (error) {
            //         console.log('Error response received');
            //     }
            //     console.log('STATUS HERE' ,response.statusCode);
            //     console.log('BODY HERE', response.body);
            //     console.log('HEADERS HERE', response.headers);
            // });
            // res.status(200).end();
        })
        .catch(function(err) {
            console.log('sendgrid error', err);
            res.status(500).end();
            res.redirect('/error')
        })
    })
})

router.get('/error', function(req,res){
    res.render('error')
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

/*Create a new event, makes a new venue, tags the venue to the event and saves to mongoose*/
router.post('/addEvent',function(req,res){
    let event;
    var newE = new Event({
        eventOwner: req.user._id,
        name: req.body.event,
    })
    return newE.save()
    .then(savedE =>{
        console.log('saved E is', savedE)
        event = savedE
        var newVenue = new VEvent ({
            venueOption: event._id,
            placeId:req.query.placeId,
            name: req.body.name
        })
        return newVenue.save()
    })
    .then(newVen => {
        console.log("new ven", newVen)
        event.vEvent.push(newVen._id)
        event.save()
        res.redirect('/venues');
    })
    .catch(function(err){
        console.log('error is ', err);
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
        console.log('event is', event)
        event.save()
        console.log('saved the event changes');
        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err)
        res.redirect('/error')
    })
})

/* ADDS A VENUE TO AN EXISTING EVENT */
router.get('/addVenue',function(req,res){
    var eventId=req.query.eventId;
    var placeId=req.query.placeId;
    var name=req.query.name;
    let newVen;
    console.log('EVENTID',eventId)
    console.log('PLACEID',placeId)
    console.log('Name',name)
    //If that venue already exists under that eventId, DON'T CREATE A NEW VENUEID
    //Do a Venue.find(venueOption=eventid) to find all of the venues under that event umbrella
    return VEvent.find({venueOption: eventId})
    .then(venues => {
        if (!venues || venues.length <= 0) {
            return false;
        }
        for(var i = 0; i < venues.length; i++) {
            if (venues[i].placeId === placeId) {
                // maybe here remove the venue if its a toggle
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
                console.log('saved new venue to event',newVen)
                return Event.findById(eventId)
            })
            .then(event => {
                console.log('event is', event);
                event.vEvent.push(newVen._id)
                event.save()
                res.redirect('/venues');
            })
            .catch(function(err){
                console.log('error is', err);
                res.redirect('/error')
            })
        } else {
            res.redirect('/venues');
        }
    })
    .catch(function(err){
        console.log('error is', err)
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
            loggedin: req.user ? true: false
        }))
    })
    .catch(function(err){
        console.log('error is', err)
        res.redirect('/error')
    })
})

/* REMOVE a specific event from the database*/
router.get('/removeEvent', function(req, res) {
    console.log('req.query here', req.query);
    var eventId= req.query.eventId;
    return VEvent.find({venueOption: eventId})
    .then(venueArr => {
        venueArr.map(venue => {
            Chat.find({chatOwner: venue._id})
            .then( msgArr => {
                msgArr.map( msg => {
                    console.log('Successfully deleted msg');
                    msg.remove()
                })
            })
            .then( () => {
                console.log('Successfully deleted venue');
                venue.remove()
            })
            .catch(function(err){
                console.log('err is', err);
                res.redirect('/error')
            })
        })
    })
    .then( () => {
        return Event.findById(eventId)
    })
    .then(event => {
        console.log('Successfully deleted event');
        event.remove()
        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err)
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
                console.log('Successfully modified the event');
            }
        }
        return event.save()
    })
    .then(() => {
        Chat.find({chatOwner: vEventId})
        .then( msgArr => {
            msgArr.map( msg => {
                console.log('Successfully deleted msg');
                msg.remove()
            })
        })
        .catch(function(err){
            console.log('error is', err);
            res.redirect('/error')
        })
    })
    .then (() => {
        return VEvent.findById(vEventId)
    })
    .then(venue => {
        venue.remove()
        console.log('Successfully removed venue');
        res.redirect('/events')
    })
    .catch(function(err){
        console.log('error is', err);
        res.redirect('/error')
    })
})

/* CONTACTLIST is the link to the questionnaire*/
router.get('/contactlist', function(req, res, next) {
    if(req.query.eventId){
        return Event.findById(req.query.eventId)
        .populate("vEvent")
        .exec()
        .then(party => {
            console.log('in here', req.user);
            res.render('contactlist', ({
                party: party,
                events: false,
                min: helper.formatDate(new Date()),
                email: req.user.email ? req.user.email: "Your Email",
                fname: req.user.fname ? req.user.fname : "Your First Name",
                lname: req.user.lname ? req.user.lname : "Your Last Name",
                loggedin: req.user ? true: false
            }))
        })
        .catch(function(err){
            console.log("error is", err)
            res.redirect('/error')
        })
    } else {
        return Event.find({eventOwner:req.user._id})
        .then(ocassions =>{
            console.log('occassions', ocassions);
            res.render('contactlist', ({
                events: ocassions,
                loggedin: req.user ? true: false
            }))
        })
        .catch(function(err){
            console.log('error is', err)
            res.redirect('/error')
        })
    }
})

/* SUBMIT CONTACTLIST we will now send an email to venues*/
router.post('/contactlist', function(req, res) {
    console.log('in contactlist', req.body)
    var eventId=req.query.eventId
    let v;
    return User.findOne({fbid: req.user.fbid})
    .then(u => {
        u.fname = req.body.fname
        u.lname = req.body.lname
        u.email = req.body.email

        return u.save()
    })
    .then(() => {
        return Event.findById(eventId)
    })
    .then(event => {
        event.date=req.body.date
        event.time=req.body.starttime
        event.hours=req.body.hours
        event.guestCount=req.body.guestCount
        event.price=req.body.price
        event.additional=req.body.additional

        return event.save()
    })
    .then(savedEvent => {
        console.log('Successfully saved event parameters');
        return VEvent.find({venueOption: eventId})
    })
    .then(venues => {
        console.log('VENUES FOR THAT EVENT',venues)
        var x = venues.map(venue => {
            v = venue
            return VData.findOne({placeId:venue.placeId})
            .then(match => {
                var web = match.domain
                console.log('THE VENUE',v)
                console.log('WEBSITE', web);
            // Check database to see if there's an email for that venue already
            // if not, retrieve email using hunter
                if(match.email.length === 0){
                    console.log('no match.email', match)
                    // helper.collectEmail(web)
                    // .then((emails) => {
                    //     console.log('RETRIEVED EMAILS', emails)
                    //     //STORE THE EMAILS IN THE DATABASE
                    //
                    //     if (emails[0]){
                    //         match.email.push(emails[0])
                    //     }
                    //     if(emails[1]){
                    //         match.email.push(emails[1])
                    //     }
                    //
                    //     return match.save()
                    // })
                    // .then(savedV => {
                    //     console.log('Successfully saved venue w emails')
                    //     helper.sendMail(req, match, v)
                    // })
                    // .catch(function(err){
                    //     console.log('error is', err);
                    //      res.redirect('/error')
                    // })
                }
                else{
                    console.log('MATCH IS', match)
                    helper.sendMail(req, match, v)
                }
            })
            .catch(function(err){
                console.log('error is', err);
                res.redirect('/error')
            })
        })
        return Promise.all(x)
    })
    .then(() => {
        res.redirect('/nextsteps')
    })
    .catch(function(err){
        console.log('error is', err);
        res.redirect('/error')
    })
})

router.get('/nextsteps',function(req,res){
    res.render('nextsteps',{
        loggedin: req.user ? true: false
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
                // msg.forEach((x) => {
                    v.chat = v.chat.replace(/(?:\r\n|\r|\n)/g, '</br>')
                // })

                console.log('vEvent is',v)
                return v.save()
            })
            .then( newV => {
                res.render('messages', {
                    events: events,
                    message: newV.chat,
                    venueId: venueId,
                    loggedin: req.user ? true: false
                })
            })
            .catch(function(err){
                console.log('error is', err);
                res.redirect('/error')
            })
        } else {
            console.log('events', events)
            res.render('messages', {
                events: events,
                loggedin: req.user ? true: false
            })
        }
    })
    .catch(function(err){
        console.log('error is', err)
        res.redirect('/error')
    })
})

/* Save user's email, send the email to last person to respond */
/* or to official business email on file if other is not available */
router.post('/msgresponse',function(req,res){
    let venue;
    let msg;
    console.log('here', req.body.response);
    var venueId= req.query.venueId
    console.log('in msg response', venueId);
    // var newMsg = new Chat({
    //     chatOwner: venueId,
    //     from: req.user.email,
    //     date: helper.formatDate(new Date()),
    //     content: req.body.response
    // })
    // return newMsg.save()
    VEvent.findById(venueId)
    .then(v => {
        venue = v
        venue.chat = `${req.body.response}</br></br>${req.user.fname} ${req.user.lname}</br></br>On ${venue.lastDate} ${venue.lastFrom} wrote:</br></br>` + venue.chat
        venue.save()
        console.log('new venue chat is', venue.chat);
    })
    .then(() => {
        return VData.findOne({placeId: venue.placeId})
    })
    .then(vSource => {
        console.log('printing this');
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
                  "value": req.body.response
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
            }
            console.log('RESPONSE', response);
            console.log('STATUS HERE' ,response.statusCode);
            console.log('BODY HERE', response.body);
        });
        res.redirect(`/messages?venueId=${venueId}`)
    })
    .catch(function(err){
        console.log('error is', err);
        res.redirect('/error')
    })
})
///////////////////////////// END OF PRIVATE ROUTES /////////////////////////////

module.exports = router;
