
// var Promise   = require('bluebird');
var boom      = require('boom');
var schemas   = require('../../schemas');
var Message   = require('../../models/message');
var URL       = require('url');

module.exports = exports = function postMessage (req, res, next) {
	var slug = req.params.slug;

	if (!schemas.isValid(slug, schemas.messageSlug)) {
		return next(boom.badRequest(`"${slug}" is not a valid message slug.`));
	}

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
