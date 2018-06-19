'use strict';

var _ = require('lodash');
var pkg = require('../package.json');
var schemas = require('../schemas');
var statusCodes = require('statuses/codes.json');

var joi2swag = require('joi-to-swagger');

var rawComponents = {};

function fromJoiSchema (schema) {
	var result = joi2swag(schema, rawComponents);
	if (result.components) {
		_.merge(rawComponents, result.components);
		if (result.components.schemas) {
			_.assign(exports.components.schemas, result.components.schemas);
		}
		if (result.components.requestBodies) {
			_.each(result.components.requestBodies, (def, key) => {
				exports.components.requestBodies[key] = { content: { 'application/json': { schema: def } } };
			});
		}
	}
	return result.swagger;
}

module.exports = exports = {
	openapi: '3.0.0',
	servers: [],
	info: {
		description: 'Sequinus API',
		title: pkg.name,
		version: pkg.version,
	},
	tags: [
		{ name: 'user', description: 'Sequinus User Accounts' },
		{ name: 'message', description: 'Sequinus Messages' },
	],
	paths: {},
	components: {
		parameters: {
			'UserAuthentication': {
				name: 'Authorization',
				in: 'header',
				description: 'This route requires a user login either via HTTP Basic Authorization or a JWT Authorization Bearer token.',
				schema: { type: 'string' },
			},
		},
		requestBodies: {},
		schemas: {},
	},
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
		content: {
			'application/json': {
				schema: { $ref: fromJoiSchema(schemas.response.error).$ref },
			},
		},
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
			var swag = fromJoiSchema(jschema.required().meta({ className: null }));
			var param = {
				required: true,
				name: key,
				in: 'path',
				schema: swag,
			};
			methodEntry.parameters.push(param);
		});
	}

	if (schema.query) {
		_.each(schema.query, (jschema, key) => {
			var swag = fromJoiSchema(jschema);
			var param = {
				name: key,
				in: 'query',
				schema: swag,
			};
			methodEntry.parameters.push(param);
		});
	}

	if (schema.body) {
		var result = fromJoiSchema(schema.body);
		methodEntry.requestBody = { $ref: result.$ref.replace('schemas', 'requestBodies') };
	}

	if (schema.responses) {
		_.each(schema.responses, (jschema, key) => {

			if (Number(key) >= 300 && Number(key) < 400) {
				methodEntry.responses[key] = {
					description: 'Redirect',
					headers: { Location: { schema: { type: 'string' } } },
				};
			} else {
				var swag = fromJoiSchema(jschema);
				methodEntry.responses[key] = {
					description: jschema._description || statusCodes[key] || 'Unknown',
					content: {
						'application/json': {
							schema: swag,
						},
					},
				};
			}
		});
	}

	if (_.includes(middleware, 'requiresUserAuth')) {
		methodEntry.parameters.push({ '$ref': '#/components/parameters/UserAuthentication' });
		methodEntry.responses[401] = errorResponse('Unauthorized - Route requires authentication');
	}

	methodEntry.responses[400] = errorResponse('Bad Request - Some request data failed validation');
	methodEntry.responses.default = errorResponse();
};

if (!module.parent) {
	// console.log(require('util').inspect(exports, { colors: true, depth: 10 })); // eslint-disable-line no-console
	console.log(JSON.stringify(exports, null, 2));  // eslint-disable-line no-console
}
