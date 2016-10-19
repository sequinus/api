
var boom    = require('boom');

exports.user = function requiresAuth (req, res, next) {
	if (!req.username) {
		return next(boom.unauthorized('Authentication token is missing or invalid'));
	}

	next();
};
