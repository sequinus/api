
var joi = require('../schemas').joi;
var merge = require('lodash/merge');

module.exports = exports = function (controller) {
	if (!controller.schema) {
		return controller;
	}

	return function (req, res, next) {
		var toValidate = {};

		[ 'params', 'body', 'query' ].forEach((key) => {
			if (controller.schema[key]) {
				toValidate[key] = req[key];
			}
		});

		joi.validate(toValidate, controller.schema, { abortEarly: false }, (err, validated) => {
			if (err) return next(err);

			// merge our sanitized request data back into the request object
			merge(req, validated);

			// execute the controller
			controller(req, res, next);
		});
	};
};
