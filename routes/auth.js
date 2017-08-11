// Add Passport-related auth routes here.
var express = require('express');
var router = express.Router();
var models = require('../models');

module.exports = function(passport) {

    // GET registration page
    router.get('/signup', function(req, res) {
        res.render('signup');
    });

    router.post('/signup', function(req, res) {
        // validation step
        if (req.body.password !== req.body.passwordRepeat) {
            return res.render('signup', {error: "Passwords don't match."});
        }
        var fname = req.body.fname
        var lname = req.body.lname
        var u = new models.User({
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
            fname: fname[0].toUpperCase() + fname.substring(1,fname.length),
            lname: lname[0].toUpperCase() + lname.substring(1,lname.length)
        });
        u.save(function(err, user) {
            if (err) {
                console.log(err);
                res.redirect('/register');
                return;
            }
            res.redirect('/login');
        });
    });

    // GET Login page
    router.get('/login', function(req, res) {
        res.render('login',{
            loggedin: req.user ? true: false,
            u:{
                fbid: u.fbid,
                displayName: req.user.displayName,
                email: req.user.email
            }
        });
    });

    // POST Login page
    router.post('/login', passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
    }));

    //Sends the user to FB, to give us permission
    router.get('/fb/login', passport.authenticate('facebook'))

    //Upon giving permission, sends user back to this route
    router.get('/fb/login/callback', passport.authenticate('facebook', {
        successRedirect: '/',
        failureRedirect: '/login'
    }))

    // GET Logout page
    router.get('/logout', function(req, res) {
        req.logout();
        req.session.destroy(function(err) {
            res.redirect('/');
        })
    });

    return router;
};
