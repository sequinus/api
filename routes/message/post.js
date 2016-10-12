
var boom      = require('boom');
var joi       = require('joi');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');

var messagePostSchema = joi.object().keys({
	body: schemas.messageBody.required(),
	private: joi.boolean(),
	inReplyTo: schemas.messageId,
});

module.exports = exports = function postUser (req, res, next) {
	schemas.validate(req.body, messagePostSchema).then((body) =>
		Promise.resolve(body.inReplyTo && Message.get(body.inReplyTo)).then((parentMessage) => {
			if (body.inReplyTo && !parentMessage) {
				throw boom.badData(`Message "${body.inReplyTo}" does not exist.`);
			}

			var options = {
				username: req.user.username,
				body: body.body,
				inReplyTo: body.inReplyTo,
				private: body.private,
			};

			return Message.create(options);
		})
	).then((message) => {
		res.json({ message });
	}).catch(next);
};
