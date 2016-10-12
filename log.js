
var bunyan = require('bunyan');
var expbun = require('express-bunyan-logger');
var config = require('./config');

module.exports = exports = function (name, options) {
	return bunyan.createLogger(Object.assign({ level: config.logLevel, name: config.name + '/' + name }, options));
};

exports.middleware = function () {
	var logger = expbun({
		name: config.name + '/express',
		level: config.logLevel,
		includesFn: (req) => Object.assign({}, req.logData),
	});

	return function (req, res, next) {
		req.logData = req.logData || {};
		return logger(req, res, next);
	};
};

exports.errorHandler = function () {
	return function (err, req, res, next) {
		if (!req.logData) req.logData = {};
		req.logData.err = err;
		next(err);
	};
};
