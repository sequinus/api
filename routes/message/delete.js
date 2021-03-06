
// var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');

module.exports = exports = function deleteMessage (req, res, next) {
	var messageid = req.params.messageid;

	Message.getById(messageid)
		.then((message) => {
			if (!message || message.deleted) {
				throw boom.notFound(`Message ID "${messageid}" does not exist.`);
			}

			if (req.user.username !== message.author) {
				throw boom.forbidden(`User "${req.user.username}" does not have permission to delete message "${messageid}".`);
			}

			return Message.delete(message.id, req.user.username);
		})
		.then(() => {
			res.status(202);
			res.json({
				success: `Message "${messageid}" has been deleted.`,
			});
		})
		.catch(next);
};

exports.uri = '/message/:messageid';
exports.method = 'delete';
exports.middleware = [ 'requiresUserAuth' ];
exports.tags = [ 'message' ];
exports.schema = {
	params: {
		messageid: schemas.messageId,
	},
	responses: {
		202: schemas.response.success,
		403: schemas.response.error,
		404: schemas.response.error,
	},
};
