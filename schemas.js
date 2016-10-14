
var joi     = require('joi');
var Promise = require('bluebird');

exports.isValid = function (value, schema) {
	return !joi.validate(value, schema).error;
};

exports.validate = function (value, schema) {
	return Promise.fromCallback((cb) => joi.validate(value, schema, { abortEarly: false }, cb));
};

exports.username    = joi.string().min(3, 'utf8').max(30, 'utf8').regex(/^[a-zA-Z0-9_-]+$/);
exports.displayname = joi.string().min(1, 'utf8').max(100, 'utf8');
exports.password    = joi.string().min(8);
exports.email       = joi.string().email().allow(false);
exports.deleted     = joi.string().isoDate().allow(false);
exports.create_time = joi.string().isoDate();

exports.messageId   = joi.string().alphanum().length(8);
exports.messageBody = joi.string().min(1, 'utf8').max(400, 'utf8');

exports.jwtToken    = joi.string().regex(/^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/);

exports.model = {};
exports.model.user = joi.object().keys({
	username:    exports.username.required(),
	displayname: exports.displayname.required(),
	email:       exports.email.required(),
	deleted:     exports.deleted.required(),
	create_time: exports.create_time.required(),
});

exports.response = {};
exports.response.root = joi.object().keys({
	name: joi.string().required(),
	version: joi.string().regex(require('semver-regex')()).required(),
	auth: exports.username,
});

exports.response.error = joi.object().keys({
	errors: joi.array().items(
		joi.object().keys({
			title: joi.string().required(),
			detail: joi.string().required(),
			stack: joi.array(),
		})
	),
});

exports.response.validationError = joi.object().keys({
	errors: joi.array().items(
		joi.object().keys({
			title: joi.string().required(),
			detail: joi.string().required(),
			path: joi.string(),
		})
	),
});
