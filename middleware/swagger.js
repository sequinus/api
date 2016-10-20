
var path    = require('path');
var URL       = require('url');
var express   = require('express');
var router    = module.exports = exports = express.Router();

var SWAGGER_PATH = path.dirname(require.resolve('swagger-ui'));

router.use((req, res, next) => {
	if (!req.query.url) {
		var query = req.query;
		query.url = '/api-docs';
		return res.redirect(301, URL.format({ query }));
	}
	next();
});

router.use(express.static(SWAGGER_PATH));
