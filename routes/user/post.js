
var config    = require('../../config');
var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var User      = require('../../models/user');
var makeToken = require('../../lib/sign-jwt');

module.exports = exports = function postUser (req, res, next) {
	var username = req.body.username;
	var password = req.body.password;
	var displayname = req.body.displayname;
	var email = req.body.email;

	User.get(username)
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
		})
		.catch(next);
};

exports.schema = {
	body: {
		username: schemas.username.required(),
		displayname: schemas.displayname,
		password: schemas.password.required(),
		email: schemas.email,
	},
};
