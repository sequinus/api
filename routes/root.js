
var config  = require('../config');
var schemas = require('../schemas');
var { joi } = schemas;

module.exports = exports = function (req, res) {
	res.json({
		name: config.name,
		version: config.version,
		auth: req.username || undefined,
	});
};

exports.uri = '/';
exports.method = 'get';
exports.schema = {
	response: joi.object().keys({
		name: joi.string().required(),
		version: joi.string().regex(require('semver-regex')()).required(),
		auth: schemas.username,
	}),
};
