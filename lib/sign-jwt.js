var config  = require('../config');
var Promise   = require('bluebird');
var signJWT = Promise.promisify(require('jsonwebtoken').sign);

module.exports = exports = function signToken (username, expiresIn) {
	return signJWT({ username }, config.jwt.secret, { expiresIn });
};
