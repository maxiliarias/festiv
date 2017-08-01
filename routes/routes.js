var express = require('express');
var router = express.Router();
var models = require('../models');
var {Blog, User, Event,VEvent, VData, Chat } = require('../models');
var {helper} = require('../helper');
var request = require('request-promise');
var fs = require('fs');
var NodeGeocoder = require('node-geocoder');
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
var clearbit = require('clearbit')(process.env.CLEARBIT);
var multer  = require('multer');
var upload = multer();
const simpleParser = require('mailparser').simpleParser;

//////////////////////////////// PUBLIC ROUTES ////////////////////////////////
// Users who are not logged in can see these routes

/* HOME PAGE where you can enter your search */
router.get('/', function(req, res, next) {

    req.session.search = req.session.search || [];
    if (req.session.search.length > 0) {
        Event.find({eventOwner: req.user._id})
            .exec(function(err,ocassions){
        // assumption, i have req.query.placeId
            var temp = JSON.parse(JSON.stringify(req.session.search));
            temp.forEach(function(venue) {
                if (venue.placeId === req.query.placeId) {
                    venue.modal = "display:block";
                } else {
                    venue.modal = "";
                }
            });
            console.log('my events', ocassions);
            res.render('list', {
                venues: temp,
                googleApi: process.env.GOOGLEPLACES,
                events: ocassions
            })
        })
    } else {
        res.render('home', {
            googleApi: process.env.GOOGLEPLACES
        });
    }
});

/* Blog Routes*/
router.get('/blog',function(req,res){
    Blog.find(function(err,blogs){
        if(err){
            console.log('error finding blogs',err);
        } else {
            res.render('blog',{blog:blogs})
        }
    })
})
router.get('/pumpkinflair',function(req,res){
    res.render('pumpkinflair')
})
router.get('/macaroonsBlooms',function(req,res){
    res.render('macaroonsBlooms')
})
router.get('/whiskyaficionados',function(req,res){
    res.render('whiskyaficionados')
})
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
            let radius = (parseInt(req.body.radius) * 1609.34).toString();
            let type = req.body.type.split(" ").join("_").toLowerCase();

            return request(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process.env.GOOGLEPLACES}&location=${lat},${long}&rankby=distance&keyword=${type}&minprice=3`+ (req.session.pagetoken ? `&pagetoken=${req.session.pagetoken}` : ``))
            .then(resp => JSON.parse(resp))
            .then(obj => {
                obj.next_page_token ? req.session.pagetoken = obj.next_page_token : ""
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
                                        newVen.save();
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
                    ))
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
router.post('/venue', function(req, res) {
    Event.find({eventOwner: req.user._id},function(err,events){
        if(err){
            console.log('error finding events in venue profile page',err);
        } else {
            console.log('found events in venue profile!');
            clearbit.Company.find({domain: req.body.website})
              .then(function (company) {
                console.log('inside clearbit ', company);
                VData.findById(req.body.placeId, function(err, foundVdata){
                    if(err){
                        console.log('err finding vData',err);
                    } else {
                        console.log('found vData, updating');
                        foundVdata.facebook = company.facebook.handle || ""
                        foundVdata.twitter = company.twitter.handle || ""
                        foundVdata.description= company.description || ""
                        foundVdata.metaD= company.site.metaDescription || ""
                        foundVdata.twitterBio= company.twitter.Bio || ""

                        foundVdata.save(function(err,savedVdata){
                            if(err){
                                console.log('error saving Vdata after update');
                            } else {
                                console.log('Successfully saved vData, now rendering venues.hbs');
                                res.render('venue',{
                                    company: company,
                                    events: events,
                                    placeId: req.body.placeId,
                                    name: req.query.name,
                                    address: req.query.address,
                                    phone: req.body.phone,
                                    photo1: req.body.photo1
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo1 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo2: req.body.photo2
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo2 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo3: req.body.photo3
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo3 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo4: req.body.photo4
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo4 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo5: req.body.photo5
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo5 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo6: req.body.photo6
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo6 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo7: req.body.photo7
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo7 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo8: req.body.photo8
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo8 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo9: req.body.photo9
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo9 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    photo10: req.body.photo10
                                    ? 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + req.body.photo10 + '&key=' + process.env.GOOGLEPLACES
                                    : '',
                                    rating: req.body.rating,
                                    lat: req.body.lat,
                                    lng: req.body.lng,
                                    hours: req.body.hours.split(','),
                                    url: req.body.url, //
                                    website: req.body.website
                                })
                            }
                        })
                    }
                })
              })
              .catch(clearbit.Company.QueuedError, function (err) {
                // Company lookup queued - try again later
              })
              .catch(clearbit.Company.NotFoundError, function (err) {
                // Company could not be found
                console.log(err);
              })
              .catch(function (err) {
                console.error(err);
              });
        }
    })
})

/*Create a new event, makes a new venue, tags the venue to the event and saves to mongoose*/
router.post('/addEvent',function(req,res){
    console.log('user id is', typeof req.user._id);
    console.log('name',req.body.event);
    console.log('placeId', typeof req.query.placeId);
    var event = new Event({
        eventOwner: req.user._id,
        name: req.body.event,
    })

    event.save(function(err,event){
        if(err){
            console.log("Error saving the new event", err)
        } else {
            console.log("Successfully saved the event")
            var newVenue = new VEvent ({
                venueOption: event._id,
                placeId:req.query.placeId,
                name: req.body.name
            })
            newVenue.save(function(err,newVen){
                if(err){
                    console.log("Error saving the new venue",err);
                } else {
                    console.log("Successfully saved the venue")
                    event.venue.push(newVen._id)
                    event.save(function(err,savedE){
                        res.redirect('/');
                    })
                }
            })
        }
    })
})

/* ADDS A VENUE TO AN EXISTING EVENT */
router.get('/addVenue',function(req,res){
    //Make this a toggle where it adds or removes the venue
    var eventId=req.query.eventId;
    var placeId=req.query.placeId;
    var name=req.query.name;
    console.log('EVENTID',eventId)
    console.log('VENUEID',venueId)
    console.log('Name',name)
    //If that venue already exists under that eventId, DON'T CREATE A NEW VENUEID
    //Do a Venue.find(venueOption=eventid) to find all of the venues under that event umbrella
    VEvent.find({venueOption: eventId})
    .then(function(venues) {
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
    .then(function(exists) {
        if (!exists) {
            var newVenue = new VEvent({
                venueOption:eventId,
                placeId:placeId,
                name:name
            })
            newVenue.save(function(err, newVen) {
                if(err){
                    console.log('could not save new Venue',err)
                } else {
                console.log('saved new venue to event',newVen)
                Event.findById(eventId)
                .exec(function(err,event){
                    if(err){
                        console.log('could not save venue Id to event',err);
                    } else {
                        event.venue.push(newVen._id)
                        event.save(function(err,savedE){
                            console.log('Saved venue Id to event',err);
                            res.redirect('/');
                        })
                    }
                })
                }
            });
        } else {
            res.redirect('/');
        }
    })
})

/* SHOW all EVENTS related to that particular user*/
router.get('/events', function(req, res) {
    Event.find({eventOwner:req.user._id})
    .populate('venue')
    .exec(function(err,events){
        res.render('events',{events: events})
    })
})

/* REMOVE a specific event from the database*/
router.get('/removeEvent', function(req, res) {
    var eventId= req.query.id;
    Event.findById(eventId)
    .exec(function(err, event){
        event.remove(function(err,event){
            if(err){
                console.log('error removing event', err)
            } else {
                console.log('Successfully removed event');
                res.redirect('/events')
            }
        })
    })
})

/* REMOVE a specific venue from an event*/
router.get('/removeVenue', function(req, res) {
    var venueid= req.query.venueid
    var eventid=req.query.eventid
    console.log('HERE', eventid)
    console.log('HERE', venueid)
    Event.findById(eventid)
    .exec(function(err,event){
        for (var i=0; i<event.venue.length; i++){
            if(event.venue[i] == venueid){
                //WHY is v still 7 in mongoose database?
                event.venue.splice(i,1)
            }
        }
        event.save(function(err,e){
            VEvent.findById(venueid)
            .exec(function(err, venue){
                venue.remove(function(err,venue){
                    if(err){
                        console.log('error removing venue', err)
                    } else {
                        console.log('Successfully removed venue');
                        res.redirect('/events')
                    }
                })
            })
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
                VEvent.find({venueOption: eventId},function(err,venues){
                    console.log('VENUES FOR THAT EVENT',venues)
                    venues.forEach(venue => {
                        VData.find({placeId:venue.placeId}, function(err,matches){
                            matches.forEach(match => {
                                var web = match.domain
                                var b;
                                console.log('THE VENUE',venue)
                                console.log('WEBSITE', web);
                                // Check database to see if there's an email for that venue already
                                //if not, retrieve email using hunter
                                if(!match.email){
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
                                    //     match.save(function(err,savedV){
                                    //         if(err){
                                    //             console.log('error saving venue email', err)
                                    //         } else {
                                    //             console.log('Successfully saved venue w emails')
                                    //             helper.sendMail(req, match, venue)
                                    //         }
                                    //     })
                                    // })
                                    console.log('bananas')
                                }
                                else{
                                    helper.sendMail(req, match, venue)
                                }
                            })
                        })
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
        console.log('MANGO',mail.to.text.slice(idSpot,atSign))

        var chat = new Chat({
            chatOwner: mail.to.text.slice(idSpot,atSign),
            date: helper.formatDate(mail.date),
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
            console.log('HI',msg);
            msg.forEach((x) => {x.content = x.content.replace(/(?:\r\n|\r|\n)/g, '</br>')})
            res.render('messages', {message: msg })
        }
    })
})


///////////////////////////// END OF PRIVATE ROUTES /////////////////////////////

module.exports = router;
