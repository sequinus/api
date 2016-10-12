
var config    = require('../../config');
var Promise   = require('bluebird');
var boom      = require('boom');
var joi       = require('joi');
var schemas   = require('../../schemas');
var User      = require('../../models/user');
var makeToken = require('../../lib/sign-jwt');

var userPostSchema = joi.object().keys({
	username: schemas.username.required(),
	displayname: schemas.displayname,
	password: schemas.password.required(),
	email: schemas.email,
});

module.exports = exports = function postUser (req, res, next) {
	schemas.validate(req.body, userPostSchema).then((body) => {

		var username = body.username;
		var password = body.password;
		var displayname = body.displayname;
		var email = body.email;

		return User.get(username)
			.then((existing) => {
				if (existing) throw boom.conflict(`"${username}" is already in use.`);

				var pUser = User.createWithPassword(username, password, { email, displayname });
				var pToken = makeToken(username, config.jwt.defaultExpire);

				return Promise.join(pUser, pToken, (user, token) => {
					res.status(201);
					res.json({
						user,
						token,
					});
				});
			});

	}).catch(next);
};
