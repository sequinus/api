
var logger  = require('./log');
var express = require('express');
var boom    = require('boom');

var app = module.exports = exports = express();

app.get('/favicon.ico', (req, res) => res.status(404).send()); // ignore favicons

app.use(logger.middleware());
app.use(require('body-parser').json());

app.use(require('./routes'));

// 404 handler
app.use((req, res, next) => next(boom.notFound('The requested path does not exist')));

// setup error handling
app.use((err, req, res, next) => {
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
		err = boom.wrap(err, !res.statusCode || res.statusCode < 400 ? 500 : res.statusCode, err.message);
	}
	next(err);
});
app.use(logger.errorHandler());
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
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
