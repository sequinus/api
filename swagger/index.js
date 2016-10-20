'use strict';

var _ = require('lodash');
var pkg = require('../package.json');
var generator = require('./generator');
var schemas = require('../schemas');

module.exports = exports = {
	swagger: '3.0',
	info: {
		description: 'Sequinus API',
		title: pkg.name,
		version: pkg.version,
	},
	produces: [ 'application/json' ],
	consumes: [ 'application/json' ],
	schemes:  [ 'http' ],
	securityDefinitions: {
		'jwt-user': {
			type: 'http',
			scheme: 'bearer',
			bearerFormat: 'JWT',
		},
		'basic-user': {
			type: 'http',
			scheme: 'basic',
		},
	},
	tags: [
		{ name: 'user', description: 'Sequinus User Accounts' },
		{ name: 'message', description: 'Sequinus Messages' },
	],
	paths: {},
	parameters: {},
	definitions: {},
};

parsePath('../routes/authenticate');
parsePath('../routes/root');
parsePath('../routes/user/get');
parsePath('../routes/user/post');
parsePath('../routes/user/delete');
parsePath('../routes/message/get');
parsePath('../routes/message/slug');
parsePath('../routes/message/post');
parsePath('../routes/message/delete');

function errorResponse (description) {
	return {
		description: description || 'Error',
		schema: generator.fromJoiSchema(schemas.response.error, exports.definitions),
	};
}

function parsePath (controllerPath) {
	var { name, uri, method, description, tags, middleware, schema } = require(controllerPath);
	// TO DO: parse auth middleware

	uri = uri.replace(/:(\w+)/g, '{$1}');

	var pathEntry = exports.paths[uri] || (exports.paths[uri] = {});
	var methodEntry = {
		tags,
		description,
		operationId: name,
		parameters: [],
		responses: {},
	};

	pathEntry[method] = methodEntry;

	if (schema.params) {
		_.each(schema.params, (jschema, key) => {
			var swag = generator.fromJoiSchema(jschema, {});
			swag.name = key;
			swag.in = 'path';
			methodEntry.parameters.push(swag);
		});
	}

	if (schema.query) {
		_.each(schema.query, (jschema, key) => {
			var swag = generator.fromJoiSchema(jschema, {});
			swag.name = key;
			swag.in = 'query';
			methodEntry.parameters.push(swag);
		});
	}

	if (schema.body) {
		_.each(schema.body, (jschema, key) => {
			var swag = generator.fromJoiSchema(jschema, exports.definitions);
			swag.name = key;
			swag.in = 'formData';
			methodEntry.parameters.push(swag);
		});
	}

	if (schema.responses) {
		_.each(schema.responses, (jschema, key) => {
			var swag = generator.fromJoiSchema(jschema, exports.definitions);
			methodEntry.responses[key] = {
				description: jschema._description || undefined,
				schema: swag,
			};
		});
	}

	if (_.includes(middleware, 'requiresUserAuth')) {
		methodEntry.security = {
			'jwt-user': {},
			'basic-user': {},
		};
		methodEntry.responses[401] = errorResponse('Unauthorized - Route requires authentication');
	}

	methodEntry.responses[400] = errorResponse('Bad Request - Some request data failed validation');
	methodEntry.responses.default = errorResponse();
};

if (!module.parent) {
	// console.log(require('util').inspect(exports, { colors: true, depth: 10 })); // eslint-disable-line no-console
	console.log(JSON.stringify(exports, null, 2));  // eslint-disable-line no-console
}
