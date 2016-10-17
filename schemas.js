
var joi     = require('joi');
var Promise = require('bluebird');
var log     = require('./log')('schemas');

exports.isValid = function (value, schema) {
	return !joi.validate(value, schema).error;
};

exports.validate = function (value, schema) {
	return Promise.fromCallback((cb) => joi.validate(value, schema, { abortEarly: false }, cb))
		.then((result) => {
			log.trace(result, 'Validated Schema');
			return result;
		}, (err) => {
			log.trace(err, 'Invalidated schema');
			throw err;
		});
};

exports.username       = joi.string().min(3, 'utf8').max(30, 'utf8').regex(/^[a-zA-Z0-9_-]+$/).allow('[deleted]');
exports.displayname    = joi.string().trim().min(1, 'utf8').max(100, 'utf8');
exports.password       = joi.string().min(8);
exports.email          = joi.string().trim().email().allow(false);
exports.deleted        = joi.string().isoDate().allow(false);
exports.create_time    = joi.string().isoDate();

exports.messageId      = joi.string().alphanum().length(10);
exports.messageBody    = joi.string().trim().min(1, 'utf8').max(400, 'utf8');
exports.messageContent = joi.string().trim().min(1, 'utf8');
exports.messageSlug    = joi.string().trim().min(1, 'utf8').max(100, 'utf8').regex(/^[a-zA-Z0-9_-]+$/);

exports.jwtToken       = joi.string().regex(/^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/);

exports.model = {};
exports.model.user = joi.object().keys({
	username:    exports.username.required(),
	displayname: exports.displayname.required(),
	email:       exports.email.required(),
	deleted:     exports.deleted.required(),
	create_time: exports.create_time.required(),
});
exports.model.message = joi.object().keys({
	id: exports.messageId.required(),
	slug: exports.messageSlug.required(),
	body: exports.messageBody.required(),
	content: exports.messageContent.required(),
	private: joi.boolean(),
	hidden: joi.boolean(),
	deleted: exports.deleted,
	deletedBy: exports.username.allow(null)
		.when('deleted', { is: joi.string(),
			then: exports.username,
		}),
	update_time: exports.create_time.required(), // not a typo, update_time is same as create_time
	create_time: exports.create_time.required(),
	author: exports.username.required(),
	parent: joi.lazy(() => exports.model.message),
	level: joi.number().integer().min(0),
	replies: joi.array().items(joi.lazy(() => exports.model.message)),
	replyCount: joi.number().integer().min(0),
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
