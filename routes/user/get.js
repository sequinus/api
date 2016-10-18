
var Promise   = require('bluebird');
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

		res.json({
			user,
		});
	}).catch(next);
};
