var mongoose = require('mongoose'), Schema = mongoose.Schema;

/*WILL NEED TO CHANGE HOW I PASS Chat Convos TO THE HBS PAGE*/
/*WILL NEED TO CHANGE THE ADD TO CART TO BE ADD TO EVENT*/
var userSchema = mongoose.Schema({
  username: String,
  password: String,
  email: String,
  fname: String,
  lname: String,
  cart: Array,
  event: [{ type: Schema.Types.ObjectId, ref: 'Event' }] //pulls in all the event ids related to this user
});

var eventSchema = mongoose.Schema({
    eventOwner: {type: Schema.Types.ObjectId, ref: 'User' }, //ties me to the userid,
    name: String, //something like Orlando's Engagement
    date: String,
    time: String,
    hours: Number,
    guestCount: Number,
    price: String,
    vEvent: [{ type: Schema.Types.ObjectId, ref: 'VEvent' }]//pulls in all the venue ids related to this specific event of a user
})

var vEventSchema = mongoose.Schema({
    venueOption:{type: Schema.Types.ObjectId, ref: 'Event' },
    placeId: String,
    name: String,
    chat:[{ type: Schema.Types.ObjectId, ref: 'Chat' }]
})

var vDataSchema = mongoose.Schema({
    placeId: String,
    name: String,
    domain: String,
    email: Array,
    description: String,
    metaD: String,
    twitterBio: String,
    twitter: String,
    facebook: String,
})

var chatSchema = mongoose.Schema({
    chatOwner: {type: Schema.Types.ObjectId, ref: 'VEvent' }, //ties me to the eventid
    date: String, //date email was sent
    from: String, //the business contact's email
    content: String
})

var blogSchema = mongoose.Schema({
    link: String,
    postTitle: String,
    blog: String,
    author: String,
    photographer: String,
    coverPhoto: String
})

Blog = mongoose.model('Blog', blogSchema);
User = mongoose.model('User', userSchema);
Event= mongoose.model('Event', eventSchema);
VEvent = mongoose.model('VEvent',vEventSchema);
VData = mongoose.model('VData',vDataSchema);
Chat= mongoose.model('Chat',chatSchema);

module.exports = {
  Blog: Blog,
  User: User,
  Event: Event,
  VEvent: VEvent,
  VData: VData,
  Chat: Chat
};
