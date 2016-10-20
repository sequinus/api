
// var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');
var URL       = require('url');

module.exports = exports = function findMessageBySlug (req, res, next) {
	var slug = req.params.slug;

	Message.getBySlug(slug)
		.then((message) => {
			if (!message) {
				throw boom.notFound(`Message slug "${slug}" does not exist.`);
			}

			var oURL = {
				pathname: '/message/' + message.id,
				query: req.query,
			};

			res.redirect(URL.format(oURL));
		})
		.catch(next);
};

exports.uri = '/slug/:slug';
exports.method = 'get';
exports.tags = [ 'message' ];
exports.schema = {
	params: {
		slug: schemas.messageSlug,
	},
	responses: {
		302: schemas.joi.any().forbidden(),
		404: schemas.response.error,
	},
};
