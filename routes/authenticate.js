
var config    = require('../config');
var boom      = require('boom');
var basic     = require('basic-auth');
var schemas   = require('../schemas');
var User      = require('../models/user');
var makeToken = require('../lib/sign-jwt');

module.exports = exports = (req, res, next) => {
	var auth = basic(req);

	if (!auth || !auth.name || !auth.pass) {
		return next(boom.unauthorized('Did not receive a valid Basic Authorization header'));
	}

	var validUsername = schemas.isValid(auth.name, schemas.username);
	var pUser  = validUsername && User.get(auth.name);
	var pValid = validUsername && User.validatePassword(auth.name, auth.pass);
	var pToken = makeToken(auth.name, config.jwt.defaultExpire);

	Promise.join(pValid, pUser, pToken, (valid, user, token) => {
		if (!user) {
			throw boom.unauthorized(`User "${auth.name}" does not exist.`);
		}

		if (!valid) {
			throw boom.unauthorized('Authentication failed');
		}

		res.json({
			user,
			token,
		});
	}).catch(next);
};
