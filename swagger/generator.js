/* eslint no-shadow:0 */
'use strict';

const assert = require('assert');
const _ = require('lodash');
const utils = require('./utils');
const generator = exports;

generator.createProperties = function (schema, definitions) {
	return _.reduce(_.get(schema, '_inner.children'), (memo, property) => {
		const schema = generator.fromJoiSchema(property.schema, definitions);

		if (schema) {
			memo[property.key] = schema;
		}

		return memo;
	}, {});
};

generator.newModel = function (schema, definitions) {
	const schemaType = utils.getPrimitiveType(schema);
	assert(schemaType !== 'array', 'generator.newModel does not support array schema');

	// Don't generate model for primitive types!
	if (utils.isPrimitiveSwaggerType(schemaType)) {
		const format = utils.getFormat(schema);

		return {
			type: utils.mapSwaggerType(schema, schemaType),
			format,
		};
	}

	const model = {
		required: [],
		properties: {},
	};

	const properties = generator.createProperties(schema, definitions);
	model.properties = _.reduce(properties, (memo, value, key) => {
		if (value.required) {
			model.required.push(key);
		}

		const pick = _.has(value, '$ref') ? [ '$ref' ] : [ 'type', 'format', 'items', 'default', 'description', '$ref', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'collectionFormat' ];
		memo[key] = _.pick(value, pick);
		return memo;
	}, model.properties);

	if (model.required.length === 0) {
		delete model.required;
	}

	const modelName = utils.generateNameWithFallback(schema, definitions, model);
	definitions[modelName] = model;

	return {
		$ref: `#/definitions/${modelName}`,
	};
};

generator.newArray = function (schema, definitions, arrayModel) {
	// TODO: Support array length in swagger schema. All arrays have to be separate schemas for this. Correct?
	arrayModel.type = 'array';

	// TODO: Improve array handling, multiple inclusion types are not supported by swagger specs.
	// Only possiblity would be to extract common denominator as interface-schema.
	const firstInclusionType = utils.getFirstInclusionType(schema);

	if (firstInclusionType) {
		const firstInclusionTypeModel = generator.fromJoiSchema(firstInclusionType, definitions);
		if (!firstInclusionTypeModel) {
			console.log('Cannot use: ', firstInclusionType);
		} else if (firstInclusionTypeModel.$ref) {
			arrayModel.items = _.pick(firstInclusionTypeModel, [ '$ref' ]);
		} else {
			arrayModel.items = _.pick(firstInclusionTypeModel, [ 'type', 'format', 'items', 'collectionFormat' ]);
		}
	} else {
		// array item schema missing -> go for string as default
		arrayModel.items = { type: 'string' };
	}

	return arrayModel;

/*
 // May extract all arrays and use a reference? Sometimes inline required?
 var required = arrayModel.required
 delete arrayModel.required
 var name = utils.generateNameWithFallback(schema, definitions, arrayModel)
 definitions[name] = arrayModel

 return {
 required: required,
 description: arrayModel.description,
 $ref: '#/definitions/' + name
 }
 */
};

generator.extractAsDefinition = function (schema, definitions, definition) {
	if (definition.type === 'array') {
		const required = definition.required;
		delete definition.required;
		const name = utils.generateNameWithFallback(schema, definitions, definition);
		definitions[name] = definition;

		return {
			required,
			description: definition.description,
			$ref: `#/definitions/${name}`,
		};
	}

	return definition;
};

generator.fromJoiSchema = function (schema, definitions) {
	assert(schema, 'Schema undefined');
	assert(schema.isJoi, 'Schema is no joi schema');

	if (utils.isSupportedSchema(schema)) {
		const schemaType = utils.getPrimitiveType(schema);
		const baseModel = utils.parseBaseModelAttributes(schema);

		if (schemaType === 'object') {
			return _.merge(baseModel, generator.newModel(schema, definitions));
		} else if (schemaType === 'array') {
			return generator.newArray(schema, definitions, baseModel);
		}

		// must be primitive or specified
		baseModel.type = utils.mapSwaggerType(schema, schemaType);
		return baseModel;
	}

	return null;
};
