
var config  = require('../config');
var boom    = require('boom');
var jwt     = require('express-jwt')(config.jwt);
var User    = require('../models/user');

function requiresAuth (req, res, next) {
	jwt(req, res, () => {
		console.log('AUTH', req.user);
		next();
	});
}

var express   = require('express');
var router    = module.exports = exports = express.Router();

router.get('/user/:username', require('./user/get'));
router.post('/user', require('./user/post'));
router.delete('/user', requiresAuth, require('./user/post'));

router.get('/authenticate', require('./authenticate'));
