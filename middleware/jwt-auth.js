
var config  = require('../config');
var boom    = require('boom');
var jwt     = require('express-jwt')(config.jwt);
var User    = require('../models/user');

module.exports = exports = function (req, res, next) {
	if (req.user) return next();

	jwt(req, res, (err) => {
		if (err) next(err);

		// no token was processed
		if (!req.user) return next();

		if (req.user.username) {
			req.log.debug(req.user, 'Received token for user');

			User.get(req.user.username).then((user) => {
				if (!user) throw boom.unauthorized('User in authentication token does not exist.');
				req.log.debug(user, 'Found user');
				user.token = req.user;
				req.user = user;
				req.username = user.username;
			}).then(next, next);

			return;
		}

		if (req.user.clientid) {
			// TO DO: Client auth
		}

		return next();
	});
};
