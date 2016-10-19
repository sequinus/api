
var config  = require('../config');
var boom    = require('boom');
var jwt     = require('express-jwt')(config.jwt);
var User    = require('../models/user');
var vc      = require('../middleware/validated-controller');

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

	req.log.debug(req.user, 'Received token for user');

	User.get(req.user.username).then((user) => {
		if (!user) throw boom.unauthorized('User in authentication token does not exist.');
		req.log.debug(user, 'Found user');
		user.token = req.user;
		req.user = user;
		req.username = user.username;
	}).then(next, next);
});

router.get('/', (req, res) => res.json({
	name: config.name,
	version: config.version,
	auth: req.username || undefined,
}));

router.get('/user/:username',                      vc(require('./user/get')));
router.post('/user',                               vc(require('./user/post')));
router.delete('/user/:username',     requiresAuth, vc(require('./user/delete')));

router.get('/message/:messageid',                  vc(require('./message/get')));
router.get('/slug/:slug',                          vc(require('./message/slug')));
router.post('/message',              requiresAuth, vc(require('./message/post')));
router.delete('/message/:messageid', requiresAuth, vc(require('./message/delete')));
