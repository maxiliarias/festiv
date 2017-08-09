var express = require('express');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var FacebookStrategy= require('passport-facebook');
var mongoose = require('mongoose');
var connect = process.env.MONGODB_URI;
var { User } = require('./models.js');

// var REQUIRED_ENV = "SECRET MONGODB_URI".split(" ");
//
// REQUIRED_ENV.forEach(function(el) {
//   if (!process.env[el]){
//     console.error("Missing required env var " + el);
//     process.exit(1);
//   }
// });

mongoose.connect(connect);

var routes = require('./routes/routes');
var auth = require('./routes/auth');
var app = express();

// view engine setup
var hbs = require('express-handlebars')({defaultLayout: 'main', extname: '.hbs'});
app.engine('hbs', hbs);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Passport
app.use(session({
  secret: process.env.SECRET,
  store: new MongoStore({mongooseConnection: mongoose.connection})
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
    console.log('USER!!!', user);
    done(null, user._id);
});

passport.deserializeUser(function(id, done) {
    console.log('id: ', id);
    User.findById(id, function(err, user) {
        done(null, user);
    });
});

//FACEBOOK LOGIN
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: 'http://localhost:3000/fb/login/callback'
},
// change localhost to process.env.DOMAIN
function(accessToken,refreshToken,profile,done){
    console.log('returning from FACEBOOK', accessToken)
    console.log('rtoken',refreshToken)
    console.log('profile',profile)
    User.findOne({fbid:profile.id}, function(err,user){
        if(err){
            console.log('error finding user in fb login', err);
        } else if (!user){
            var u = new User({
                rtoken: refreshToken,
                fbid: profile.id,
                email: profile.email,
                fname: profile.first_name,
                lname: profile.last_name
            });
            u.save(function(err, user) {
              if (err) {
                console.log(err);
                res.redirect('/register');
                return;
              }
              done(null,u)
            });
        } else {
            done(null,user)
        }
    })
}));

// passport strategy
passport.use(new LocalStrategy(function(username, password, done) {
  // Find the user with the given username
  User.findOne({
    username: username
  }, function(err, user) {
    // if there's an error, finish trying to authenticate (auth failed)
    if (err) {
      console.error('Error fetching user in LocalStrategy', err);
      return done(err);
    }
    // if no user present, auth failed
    if (!user) {
      console.log("no user");
      return done(null, false, {message: 'Incorrect username.'});
    }
    // if passwords do not match, auth failed
    // TODO: hash password...
    if (user.password !== password) {
      return done(null, false, {message: 'Incorrect password.'});
    }
    // auth has has succeeded
    console.log('success');
    return done(null, user);
  });
}));

app.use('/', auth(passport));
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var port = process.env.PORT || 3000;

app.listen(port);
console.log('Express started. Listening on port %s', port);
