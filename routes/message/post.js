
var config    = require('../../config');
var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var joi       = schemas.joi;
var Message   = require('../../models/message');
var markdown  = require('../../lib/markdown');

module.exports = exports = function createMessage (req, res, next) {
	Promise.join(
		Promise.resolve(req.body.inReplyTo && Message.getById(req.body.inReplyTo)),
		Promise.resolve(req.body.slug && Message.getBySlug(req.body.slug)),
		(parentMessage, existingSlug) => {
			if (req.body.inReplyTo && !parentMessage) {
				throw boom.badData(`Message ID "${req.body.inReplyTo}" provided as parent does not exist.`);
			}

			if (existingSlug) {
				throw boom.conflict(`A message already exists with the slug of "${req.body.slug}".`);
			}

			var private = req.body.private;
			var hidden;
			// if a hidden value is defined, use it
			if (typeof req.body.hidden !== 'undefined') {
				hidden = req.body.hidden;
			// otherwise, if this is a child post, hidden is the private value
			} else if (req.body.inReplyTo) {
				hidden = private;
			// if this is a topic, hidden defaults to false
			} else {
				hidden = false;
			}

			// if message is a top level topic, strip out any markdown formatting.
			var content = req.body.inReplyTo ? markdown(req.body.body).trim() : markdown.strip(req.body.body).trim();

			if (!content) {
				throw boom.notAcceptable('Message body resulted in an empty message.');
			}

			var options = {
				username: req.user.username,
				body: req.body.body,
				content,
				inReplyTo: req.body.inReplyTo,
				private,
				hidden,
				slug: req.body.slug,
			};

			var pMessage = Message.create(options);

			if (req.body.metadata) {
				return pMessage.then((message) =>
					Message.updateMetadata(message.id, req.body.metadata).then((metadata) => {
						message.metadata = metadata;
						return message;
					}));
			}

			return pMessage;
		}
	).then((message) => {
		res.status(201);
		res.json({ message });
	}).catch(next);
};

exports.uri = '/message';
exports.method = 'post';
exports.middleware = [ 'requiresUserAuth' ];
exports.tags = [ 'message' ];
exports.schema = {
	body: schemas.joi.object().keys({
		body: schemas.messageBody.required(),
		private: joi.boolean(),
		inReplyTo: schemas.messageId,
		slug: schemas.messageSlug,
		metadata: joi.array().max(config.messages.metadata.maxEntries).items(schemas.messageMetadata.meta({ className: 'MessageMetadataInput' })),
	}).meta({ className: 'CreateMessageBody', classTarget: 'requestBodies' }),
	responses: {
		201: schemas.joi.object().keys({
			message: schemas.model.message,
		}).description('Success').meta({ className: 'MessageResponse' }),
		406: schemas.response.error.description('Not Acceptable - Body resulted in empty content'),
		409: schemas.response.error.description('Conflict - Message slug is already in use'),
		422: schemas.response.error.description('Bad Data - Message parent does not exist'),
	},
};
