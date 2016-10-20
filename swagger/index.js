'use strict';

var _ = require('lodash');
var pkg = require('../package.json');
var generator = require('./generator');
var schemas = require('../schemas');
var statusCodes = require('statuses/codes.json');

module.exports = exports = {
	swagger: '2.0',
	info: {
		description: 'Sequinus API',
		title: pkg.name,
		version: pkg.version,
	},
	produces: [ 'application/json' ],
	consumes: [ 'application/json' ],
	schemes:  [ 'http' ],
	tags: [
		{ name: 'user', description: 'Sequinus User Accounts' },
		{ name: 'message', description: 'Sequinus Messages' },
	],
	paths: {},
	parameters: {
		'UserAuthentication': {
			name: 'Authorization',
			in: 'header',
			description: 'This route requires a user login either via HTTP Basic Authorization or a JWT Authorization Bearer token.',
			type: 'string',
		},
	},
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
		schema: { $ref: generator.fromJoiSchema(schemas.response.error, exports.definitions).$ref },
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
			var swag = generator.fromJoiSchema(jschema.required(), {});
			swag.required = true;
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
		var swagBody = generator.fromJoiSchema(schema.body, exports.definitions);
		methodEntry.parameters.push({
			name: 'body',
			in: 'body',
			schema: { $ref: swagBody.$ref },
		});
	}

	if (schema.responses) {
		_.each(schema.responses, (jschema, key) => {

			if (Number(key) >= 300 && Number(key) < 400) {
				methodEntry.responses[key] = {
					description: 'Redirect',
					headers: { Location: { type: 'string' } },
				};
			} else {
				var swag = generator.fromJoiSchema(jschema, exports.definitions);
				methodEntry.responses[key] = {
					description: jschema._description || statusCodes[key] || 'Unknown',
					schema: { $ref: swag.$ref },
				};
			}
		});
	}

	if (_.includes(middleware, 'requiresUserAuth')) {
		methodEntry.parameters.push({ '$ref': '#/parameters/UserAuthentication' });
		methodEntry.responses[401] = errorResponse('Unauthorized - Route requires authentication');
	}

	methodEntry.responses[400] = errorResponse('Bad Request - Some request data failed validation');
	methodEntry.responses.default = errorResponse();
};

if (!module.parent) {
	// console.log(require('util').inspect(exports, { colors: true, depth: 10 })); // eslint-disable-line no-console
	console.log(JSON.stringify(exports, null, 2));  // eslint-disable-line no-console
}
