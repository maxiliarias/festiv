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
    venue: [{ type: Schema.Types.ObjectId, ref: 'Venue' }]//pulls in all the venue ids related to this specific event of a user
})

var venueSchema = mongoose.Schema({
    venueOption:{type: Schema.Types.ObjectId, ref: 'Event' },
    placeId: String,
    name: String,
    domain: String,
    email: Array,
    chat:[{ type: Schema.Types.ObjectId, ref: 'Chat' }]
})

var chatSchema = mongoose.Schema({
    chatOwner: {type: Schema.Types.ObjectId, ref: 'Venue' }, //ties me to the eventid
    date: String, //date email was sent
    from: String, //the business contact's email
    content: String
})

var blogSchema = mongoose.Schema({
    postTitle: String,
    blog: String,
    author: String,
    photographer: String,
    coverPhoto: String
})

Blog = mongoose.model('Blog', blogSchema);
User = mongoose.model('User', userSchema);
Event= mongoose.model('Event', eventSchema);
Venue = mongoose.model('Venue',venueSchema);
Chat= mongoose.model('Chat',chatSchema);

module.exports = {
  Blog: Blog,
  User: User,
  Event: Event,
  Venue: Venue,
  Chat: Chat
};
