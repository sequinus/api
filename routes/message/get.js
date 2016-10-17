
// var Promise   = require('bluebird');
var boom      = require('boom');
var joi       = require('joi');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');

var queryParams = joi.object().unknown().keys({
	depth: joi.number().integer().min(0).max(20).default(0),
	context: joi.number().integer().min(0).max(20).default(0),
	maxReplies: joi.number().integer().min(0).max(50).default(10),
	skipReplies: joi.number().integer().min(0).default(0),
	sortReplies: joi.string().valid('newest', 'oldest').default('oldest'),
});

module.exports = exports = function postMessage (req, res, next) {
	var messageid = req.params.messageid;

	if (!schemas.isValid(messageid, schemas.messageId)) {
		return next(boom.badRequest(`Message ID "${messageid}" is not a valid message id.`));
	}

	schemas.validate(req.query, queryParams)
		.then((query) => {
			Object.assign(query, {
				forUser: req.username,
			});

			return Message.getById(req.params.messageid, query);
		})
		.then((message) => {
			if (!message) {
				throw boom.notFound(`Message ID "${messageid}" does not exist.`);
			}

			res.status(200);
			res.json({ message });
		})
		.catch(next);
};
