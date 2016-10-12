
var boom      = require('boom');
var schemas   = require('../../schemas');
var User      = require('../../models/user');

module.exports = exports = (req, res, next) => {
	var username = req.params.username;

	var pUser = schemas.isValid(username, schemas.username) && User.get(username);

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
			message: `User "${username}" has been deleted.`,
		});
	}).catch(next);
};
