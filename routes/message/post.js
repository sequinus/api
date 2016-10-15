
var Promise   = require('bluebird');
var boom      = require('boom');
var joi       = require('joi');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');

var messagePostSchema = joi.object().keys({
	body: schemas.messageBody.required(),
	private: joi.boolean(),
	inReplyTo: schemas.messageId,
	slug: schemas.messageSlug,
});

module.exports = exports = function postUser (req, res, next) {
	schemas.validate(req.body, messagePostSchema).then((body) => Promise.join(
		Promise.resolve(body.inReplyTo && Message.getById(body.inReplyTo)),
		Promise.resolve(body.slug && Message.getBySlug(body.slug)),
		(parentMessage, existingSlug) => {
			if (body.inReplyTo && !parentMessage) {
				throw boom.badData(`Message ID "${body.inReplyTo}" provided as parent does not exist.`);
			}

			if (existingSlug) {
				throw boom.conflict(`A message already exists with the slug of "${body.slug}".`);
			}

			var options = {
				username: req.user.username,
				body: body.body,
				inReplyTo: body.inReplyTo,
				private: body.private,
				slug: body.slug,
			};

			return Message.create(options);
		}
	)).then((message) => {
		res.status(202);
		res.json({ message });
	}).catch(next);
};
