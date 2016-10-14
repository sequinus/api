
var config  = require('../config');
var boom    = require('boom');
var jwt     = require('express-jwt')(config.jwt);
var User    = require('../models/user');

function requiresAuth (req, res, next) {
	if (!req.username) {
		return next(boom.unauthorized('Authentication token is missing or invalid'));
	}

	next();
}

var express   = require('express');
var router    = module.exports = exports = express.Router();

router.get('/authenticate', require('./authenticate'));

router.use(jwt);
router.use((req, res, next) => {
	if (!req.user || !req.user.username) {
		return next();
	}

	User.get(req.user.username).then((user) => {
		if (!user) return next(boom.unauthorized('User in authentication token does not exist.'));
		user.token = req.user;
		req.user = user;
		req.username = user.username;
		next();
	});
});

router.get('/', (req, res) => res.json({
	name: config.name,
	version: config.version,
	auth: req.username || undefined,
}));

router.get('/user/:username', require('./user/get'));
router.post('/user', require('./user/post'));
router.delete('/user/:username', requiresAuth, require('./user/delete'));

