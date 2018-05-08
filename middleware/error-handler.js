/* eslint no-shadow:0 */

var logger  = require('../log');
var boom    = require('boom');

module.exports = exports = function errorHandler (err, req, res, next) { // eslint-disable-line no-unused-vars
	// If it's a JWT rejection, cast it to a 401 error
	if (err.name === 'UnauthorizedError') {
		err = boom.unauthorized(err.message);
	}

	// if it's a Joi rejection, output a custom response
	if (err.name === 'ValidationError') {
		res.status(400);
		res.json({
			errors: err.details.map((detail) => ({
				title: 'Request data is missing or in the incorrect format.',
				detail: detail.message,
				path: detail.path,
			})),
		});
		return;
	}

	if (!err.isBoom) {
		req.log.error(err);
		err = boom.boomify(err, !res.statusCode || res.statusCode < 400 ? 500 : res.statusCode, err.message);
	}

	logger.errorHandler()(err, req, res, (err) => {
		var payload = err.output.payload;

		if (err.output.headers) {
			res.set(err.output.headers);
		}

		res.status(err.output.statusCode);

		res.json({
			errors: [ {
				title: payload.error,
				detail: payload.message,
				stack: process.env.NODE_ENV === 'production' ? undefined : err.stack && err.stack.split('\n'),
			} ],
		});
	});

};
