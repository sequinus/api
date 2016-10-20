
// var config  = require('../config');
var basic   = require('../middleware/basic-auth');
var jwt     = require('../middleware/jwt-auth');
var vc      = require('../middleware/validated-controller');
var swagui  = require('../middleware/swagger');

var middlewareMap = {
	requiresUserAuth: require('../middleware/auth-required').user,
};

function addController (path) {
	var controller = require(path);
	var { uri, method, middleware } = controller;

	middleware = (middleware || []).map((name) => {
		if (typeof name === 'function') return name;

		if (typeof name === 'string' && middlewareMap[name]) {
			return middlewareMap[name];
		}

		throw new Error('Unknown middleware: ' + name);
	});

	var args = [ uri ].concat(middleware, [ vc(controller) ]);

	router[method](...args);
}

var express   = require('express');
var router    = module.exports = exports = express.Router();

router.use('/api-docs', (req, res) => {
	res.json(require('../swagger'));
});

router.use('/docs', swagui);

router.use(basic);

addController('./authenticate');

router.use(jwt);

addController('./root');
addController('./user/get');
addController('./user/post');
addController('./user/delete');
addController('./message/get');
addController('./message/slug');
addController('./message/post');
addController('./message/delete');
