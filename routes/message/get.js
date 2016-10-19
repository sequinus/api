
// var Promise   = require('bluebird');
var boom      = require('boom');
var joi       = require('joi');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');

module.exports = exports = function getMessage (req, res, next) {
	var messageid = req.params.messageid;

	var query = Object.assign({}, req.query, {
		forUser: req.username,
	});

	return Message.getById(req.params.messageid, query)
		.then((message) => {
			if (!message) {
				throw boom.notFound(`Message ID "${messageid}" does not exist.`);
			}

			res.status(200);
			res.json({ message });
		})
		.catch(next);
};

exports.uri = '/message/:messageid';
exports.method = 'get';
exports.tags = [ 'message' ];
exports.schema = {
	params: {
		messageid: schemas.messageId,
	},
	query: {
		depth: joi.number().integer().min(0).max(20).default(0),
		context: joi.number().integer().min(0).max(20).default(0),
		maxReplies: joi.number().integer().min(0).max(50).default(10),
		skipReplies: joi.number().integer().min(0).default(0),
		sortReplies: joi.string().valid('newest', 'oldest').default('oldest'),
	},
	responses: {
		200: schemas.joi.object().keys({
			message: schemas.model.message,
		}),
	},
};
