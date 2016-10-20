
var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var User      = require('../../models/user');

module.exports = exports = function getUser (req, res, next) {
	var username = req.params.username;

	var pUser = User.get(username);

	Promise.resolve(pUser).then((user) => {
		if (!user) {
			throw boom.notFound(`User "${username}" does not exist.`);
		}

		res.json({
			user,
		});
	}).catch(next);
};

exports.uri = '/user/:username';
exports.method = 'get';
exports.tags = [ 'user' ];
exports.schema = {
	params: {
		username: schemas.username,
	},
	responses: {
		200: schemas.joi.object().keys({
			user: schemas.model.user.required(),
		}).meta({ className: 'UserResponse' }),

		404: schemas.response.error,
	},
};
