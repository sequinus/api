
var config   = require('./config');
var Promise  = require('bluebird');
var log      = require('./log')('schemas');
var jsonSize = require('json-size');

var Joi = require('joi');
var joi = Joi.extend({
	base: Joi.object(),
	name: 'object',
	language: {
		jsonMax: 'cannot be larger than {{maximum}} bytes when JSON serialized',
	},
	rules: [
		{
			name: 'jsonMax',
			params: {
				max: Joi.alternatives([ Joi.number().required() ]),
			},
			validate (params, value, state, options) {
				var size = jsonSize(value);

				if (size > params.max) {
					return this.createError('object.jsonMax', {
						value: JSON.stringify(value).substr(0, 50) + ' ...',
						totalSize: size,
						maximum: params.max,
					}, state, options);
				}

				return value;
			},
		},
	],
});

exports.joi = joi;

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
			throw Object.create(err);
		});
};

exports.username = joi.string()
	.min(3, 'utf8')
	.max(30, 'utf8')
	.regex(/^[a-zA-Z0-9_-]+$/)
	.meta({ swagger: {
		type: 'string',
		minLength: 3,
		maxLength: 30,
		pattern: '^[a-zA-Z0-9_-]+$',
	} });
exports.usernameDeletable = exports.username
	.allow('[deleted]')
	.meta({ swagger: {
		type: 'string',
		minLength: 3,
		maxLength: 30,
		pattern: '^[a-zA-Z0-9_-]+|\\[deleted\\]$',
	} });

exports.displayname     = joi.string().trim().min(1, 'utf8').max(100, 'utf8');
exports.password        = joi.string().min(8);
exports.email           = joi.string().trim().email().allow(false).default(false).meta({ swagger: { type: [ 'string', 'boolean' ], default: false, format: 'email' } });
exports.deleted         = joi.string().isoDate().allow(false).meta({ swagger: { type: [ 'string', 'boolean' ], default: false, format: 'datetime' } });
exports.create_time     = joi.string().isoDate();

exports.messageId       = joi.string().alphanum().length(10);
exports.messageBody     = joi.string().trim().min(1, 'utf8').max(400, 'utf8');
exports.messageContent  = joi.string().trim().min(1, 'utf8');
exports.messageSlug     = joi.string().trim().min(1, 'utf8').max(100, 'utf8').regex(/^[a-zA-Z0-9_-]+$/);
exports.messageMetadata = joi.object().keys({
	type: joi.string().alphanum().min(2).required(),
	value: joi.alternatives(
		joi.object().jsonMax(config.messages.metadata.maxSize),
		joi.string().max(config.messages.metadata.maxSize),
		joi.number(),
		joi.boolean()
	).required().meta({ swaggerType: [ 'string', 'integer', 'boolean' ] })
	.description('Value may contain any data storable as JSON, but the serialized contents must be less than ' + config.messages.metadata.maxSize + ' bytes'),
}).meta({ className: 'MessageMetadataInput' });

exports.jwtToken       = joi.string().regex(/^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/);

exports.model = {};
exports.model.user = joi.object().keys({
	username:    exports.usernameDeletable.required(),
	displayname: exports.displayname.required(),
	email:       exports.email.required(),
	deleted:     exports.deleted.required(),
	create_time: exports.create_time.required(),
}).meta({ className: 'UserModel' });

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
	author: exports.usernameDeletable.required(),
	parent: joi.lazy(() => exports.model.message).meta({ swagger: { '$ref': '#/definitions/MessageModel' } }),
	level: joi.number().integer().min(0),
	replies: joi.array().items(joi.lazy(() => exports.model.message)).meta({ swagger: { '$ref': '#/definitions/MessageModel' } }),
	replyCount: joi.number().integer().min(0),
	metadata: joi.array().max(config.messages.metadata.maxEntries).items(exports.messageMetadata.keys({
		create_time: exports.create_time.required(),
	}).meta({ className: 'MessageMetadataModel' })),
}).meta({ className: 'MessageModel' });

exports.response = {};

exports.response.error = joi.object().keys({
	errors: joi.array().items(
		joi.object().keys({
			title: joi.string().required(),
			detail: joi.string().required(),
			stack: joi.array(),
			path: joi.array().items(joi.string()),
		}).meta({ className: 'Error' })
	),
}).meta({ className: 'ErrorResponse' }).description('Error');

exports.response.validationError = joi.object().keys({
	errors: joi.array().items(
		joi.object().keys({
			title: joi.string().required(),
			detail: joi.string().required(),
			path: joi.array().items(joi.string()),
		}).meta({ className: 'ValidationError' })
	),
}).meta({ className: 'ValidationErrorResponse' }).description('Invalid Request Data');

exports.response.success = exports.joi.object().keys({
	success: exports.joi.string().required(),
}).meta({ className: 'SuccessResponse' }).description('Success');
