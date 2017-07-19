var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
  username: String,
  password: String,
  email: String,
  fname: String,
  lname: String,
  cart: Array
});

User = mongoose.model('User', userSchema);

module.exports = {
  User: User
};
