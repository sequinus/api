
var config    = require('../config');
var schemas   = require('../schemas');
var { joi }   = schemas;

var makeToken = require('../lib/sign-jwt');

module.exports = exports = function getAuthToken (req, res, next) {
	makeToken(req.username, config.jwt.defaultExpire).then((token) => {
		res.json({
			user: req.user,
			token,
		});
	}).catch(next);
};

exports.uri = '/authenticate';
exports.method = 'get';
exports.middleware = [ 'requiresUserAuth' ];
exports.tags = [ 'user' ];
exports.schema = {
	response: joi.object().keys({
		user: schemas.model.user.required(),
		token: schemas.jwtToken.required(),
	}),
};
