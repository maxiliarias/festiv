var express = require('express');
var crypto = require('crypto');
var router = express.Router() //router is able to accept get/post requests
var models = require('./models/models');
var Token = models.Token;
var User = models.User;
var Post = models.Post;

router.get('/',function(req,res){
  res.json({message: 'hello'})
})

router.post('/users/register', function(req,res){
  var newUser = new User({
    fname: req.body.fname,
    lname: req.body.lname,
    email: req.body.email,
    password: req.body.password
  })
  console.log(req.params);
  console.log(req.query);
  console.log(req.body);
  newUser.save(function(err,usr){
    if(err){
      res.json({failure: "database error"})
    } else{
      res.json({success: 'truea'})
    }
  })
})

router.post('/users/login', function(req,res){
  User.findOne({
    email: req.body.email,
    password: req.body.password
  }, function(err, resp){
    if(err){
      res.json({
        error: "Login failed"})
      }
      else{
        var newToken = new Token({
          userId: resp._id,
          token: crypto.createHash('md5').update(resp.email + new Date()).digest('hex'),
          createdAt: new Date()
        })
        newToken.save(function(err,token){
          if (err){
            res.json({
              error: "Failed to save data."
            })
          } else{
            res.json({
              success: true,
              response: {
                id: newToken.userId,
                token: newToken.token
              }
            })
          }
        })
      }
    })
  });

router.get('/users/logout', function(req,res){
    Token.findOne({
      token: req.query.token
    }, function(err, resp){
      if (err) {
        res.json({error: "Token cannot be verified."})
        return;
      }
      resp.remove(function(err,token){
        if(err){
          res.json({
            error: "Token could not be removed"
          })
        } else{
          res.json({
            "success": true,
          })
        }
      })
    })
  });

router.get('/posts/:page',function(req,res){
    Token.findOne({
      token: req.query.token,
    }, function(err, resp){
      if (err) {
        res.json({
          error: "Token cannot be verified."
        })
        return;
      }else{
        var page= req.params.page
        Post.find({}).limit(10).skip(10*(page-1)).exec(function(err,posts){
          console.log(posts)
          if(err){
            res.json({
              error: "could not find post"
            })
          }
          else {
            res.json({
              success: true,
              response: posts
            })
          }
        }) //
      }
    })
  })

router.post('/posts',function(req,res){
    Token.findOne({
      token: req.body.token,
    }, function(err, resp){
      if (err) {
        res.json({error: "Token cannot be verified."})
        return;
      }
      else{
        if(resp){
          var userId= resp.userId
          var name= User.findById(userId,function(err,user){
            var newPost = new Post({
              poster:{
                name: user.fname + " " + user.lname,
                id: userId
              },
              content: req.body.content,
              likes: [],
              comments: [],
              createdAt: new Date()
            })
            newPost.save(function(err,post){
              if (err){
                res.json({
                  error: "Failed to save post."
                })
              } else{
                res.json({
                  success: true,
                  response: {
                    poster: {
                      name: post.poster.name,
                      id: post.poster.id
                    },
                    content: post.content,
                    createdAt: post.createdAt,
                    _id: post.poster.id,
                    comments: post.comments,
                    likes: post.likes
                  }
                })
              }
            })
          })
        }
      }
    })
  })

router.post('/posts/comments/:post_id',function(req,res){
    Token.findOne({
      token: req.body.token,
    }, function(err, resp){
      if (err) {
        res.json({error: "Token cannot be verified."})
        return;
      }
      else{
        var postId= req.params.post_id;
        var userId= resp.userId;

        User.findById(userId,function(err,user){
          if(err){
            res.json({
              error: "User not found"
            })
          } else{
            Post.findById(postId,function(err,post){

              if (err){
                res.json({
                  error: "Failed to find post."
                })
              } else{
                post.comments.push({
                  createdAt: new Date(),
                  content: req.body.content,
                  poster:{
                    name: user.fname + " " + user.lname,
                    id:userId
                  }
                })
                post.save(function(err,post){
                  res.json({
                    success: true,
                    response:post,
                  })
                })
              }
            })
          }
        })
      }
    })
  })

router.get('/posts/comments/:post_id',function(req,res){
  Token.findOne({
    token: req.query.token,
  }, function(err, resp){
    if (err) {
      res.json({
        error: "Token cannot be verified."
      })
    }
    else{
      var postId= req.params.post_id

      Post.findById(postId,function(err,post){
        if(err){
          res.json({
            error: "cannot find post"
          })
        }else{
          res.json({
            success: true,
            response: post.comments
          })
        }
      })
    }
  })
})

router.get('/posts/likes/:postid',function(req,res){
  Token.findOne({
    token: req.query.token,
  }, function(err, resp){
    if (err) {
      res.json({
        error: "Token cannot be verified."
      })
    }
    else{
      var postId= req.params.postid
      Post.findById(postId,function(err,post){
        if(err){
          res.json({
            error: "cannot find post"
          })
        }else{
          res.json({
            success: true,
            response: post
          })
        }
      })
    }
  })
})

module.exports= router
