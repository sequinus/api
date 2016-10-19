
var Promise = require('bluebird');
var boom    = require('boom');
var basic   = require('basic-auth');
var schemas = require('../schemas');
var User    = require('../models/user');

module.exports = exports = function (req, res, next) {
	if (req.user) return next();

	var auth = basic(req);

	if (!auth || !auth.name || !auth.pass) {
		return next();
	}

	req.log.debug(req.user, 'Received basic auth for user');

	var validUsername = schemas.isValid(auth.name, schemas.username);
	var pUser  = validUsername && User.get(auth.name);
	var pValid = validUsername && User.validatePassword(auth.name, auth.pass);

	Promise.join(pValid, pUser, (valid, user) => {
		if (!user) {
			throw boom.unauthorized(`User "${auth.name}" does not exist.`);
		}

		if (!valid) {
			throw boom.unauthorized('Authentication failed');
		}

		req.log.debug(user, 'Found user');
		req.user = user;
		req.username = user.username;
	}).then(next, next);
};
