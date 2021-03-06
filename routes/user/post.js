
var config    = require('../../config');
var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var User      = require('../../models/user');
var makeToken = require('../../lib/sign-jwt');

module.exports = exports = function createUser (req, res, next) {
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

exports.uri = '/user';
exports.method = 'post';
exports.tags = [ 'user' ];
exports.schema = {
	body: schemas.joi.object().keys({
		username: schemas.username.required(),
		displayname: schemas.displayname,
		password: schemas.password.required(),
		email: schemas.email,
	}).meta({ className: 'CreateUserBody', classTarget: 'requestBodies' }),
	responses: {
		201: schemas.joi.object().keys({
			user: schemas.model.user.required(),
			token: schemas.jwtToken.required(),
		}).meta({ className: 'UserTokenResponse' }),

		409: schemas.response.error.description('Conflict - User already exists'),
	},
};
