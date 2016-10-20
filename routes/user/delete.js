
var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var User      = require('../../models/user');

module.exports = exports = function deleteUser (req, res, next) {
	var username = req.params.username;

	var pUser = User.get(username);

	Promise.resolve(pUser).then((user) => {
		if (!user) {
			throw boom.notFound(`User "${username}" does not exist.`);
		}

		if (req.user.username !== username) {
			throw boom.forbidden(`User "${req.user.username}" does not have permission to delete User "${username}".`);
		}

		return User.delete(username);
	}).then(() => {
		res.status(202);
		res.json({
			success: `User "${username}" has been deleted.`,
		});
	}).catch(next);
};

exports.uri = '/user/:username';
exports.method = 'delete';
exports.tags = [ 'user' ];
exports.middleware = [ 'requiresUserAuth' ];
exports.schema = {
	params: {
		username: schemas.username,
	},
	responses: {
		202: schemas.response.success,
		403: schemas.response.error,
		404: schemas.response.error,
	},
};
