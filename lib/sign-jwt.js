var config  = require('../config');
var Promise = require('bluebird');
var jwt     = require('jsonwebtoken');
var sign    = Promise.promisify(jwt.sign);


module.exports = exports = function signToken (username, expiresIn) {
	return sign({ username }, config.jwt.secret, { expiresIn: expiresIn || config.jwt.defaultExpire });
};

exports.decodeSync = function decodeSync (token) {
	return jwt.verify(token, config.jwt.secret);
};
