'use strict';

/**
 * This code copied from https://github.com/ksmithut/swaggerize-ui which was released
 * under an MIT license.
 */

const _ = require('lodash');
const utils = exports;

utils.getRequestConnection = function (request) {
	// request.server fallback for hapi < 8
	return request.connection || request.server;
};

utils.getRoutesModifiers = function (plugin) {
	// plugin.config fallback for hapi < 8
	return plugin.config || _.get(plugin, 'realm.modifiers');
};

utils.firstCharToUpperCase = function (string) {
	if (!string || string.length === 0) {
		return string;
	}
	return string.charAt(0).toUpperCase() + string.slice(1);
};

utils.generateNameFromSchema = function (schema) {
	const isArray = schema && schema._type === 'array';
	const isPrimitive = schema && utils.isPrimitiveSwaggerType(schema._type);
	let keys = [];

	if (isPrimitive) {
		return utils.firstCharToUpperCase(utils.getPrimitiveType(schema));
	} else if (isArray) {
		return 'Array';
	}

	const children = _.get(schema, '_inner.children');
	keys = _.map(_.map(children, 'key'), utils.firstCharToUpperCase);

	if (_.isEmpty(keys)) {
		return 'EmptyModel';
	}

	keys.push('Model');
	return keys.join('');
};

utils.parseTags = function (tags) {
	if (_.isEmpty(tags)) {
		return null;
	}

	const tagsList = _.isArray(tags) ? tags : tags.split(',');
	const included = [];
	const excluded = [];

	_.each(tagsList, (tag) => {
		tag = tag.trim();
		const firstChar = tag.trim().charAt(0);

		if (firstChar === '+') {
			included.push(tag.substr(1));
		} else if (firstChar === '-') {
			excluded.push(tag.substr(1));
		} else {
			included.push(tag);
		}
	});

	return {
		included,
		excluded,
	};
};

utils.filterRoutesByRequiredTags = function (routingTable, requiredTags) {
	if (_.isEmpty(requiredTags)) {
		return routingTable;
	}

	return _.filter(routingTable, (route) => {
		const routeTags = route.settings ? route.settings.tags : null;
		return _.intersection(routeTags, requiredTags).length === requiredTags.length;
	});
};

utils.filterRoutesByTagSelection = function (routingTable, includedTags, excludedTags) {
	return _.filter(routingTable, (route) => {
		const routeTags = route.settings ? route.settings.tags : null;

		if (_.intersection(routeTags, excludedTags).length > 0) {
			return false;
		} else if (!includedTags || includedTags.length === 0 || _.intersection(routeTags, includedTags).length > 0) {
			return true;
		}

		return false;
	});
};

utils.getCurrentSettings = function (settings, serverSettings) {
	if (!serverSettings) {
		return settings;
	}

	const currentSettings = _.defaults({}, settings, serverSettings);
	currentSettings.tags = _.union(utils.getTags(settings), utils.getTags(serverSettings));
	return currentSettings;
};

utils.stripRoutesPrefix = function (routingTable, stripPrefix) {
	if (!stripPrefix) {
		return routingTable;
	}

	const stripPrefixLength = stripPrefix.length;

	return _.reduce(routingTable, (memo, route) => {
		if (route.path.indexOf(stripPrefix) === 0) {
			const routeClone = _.clone(route);
			if (route.path.length > stripPrefixLength) {
				routeClone.path = route.path.substr(stripPrefixLength);
				memo.push(routeClone);
			}
		}
		return memo;
	}, []);
};

utils.filterRoutesByPrefix = function (routingTable, prefix) {
	const prefixLength = prefix.length;
	return _.filter(routingTable, (route) => {
		const routePath = route.path;
		const startsWithPrefix = routePath.indexOf(prefix) === 1;

		if (startsWithPrefix) {
			return (routePath.length === prefixLength + 1 || routePath.charAt(prefixLength + 1) === '/');
		}
		return false;
	});
};

utils.sanitizePath = function (path) {
	return path.replace(/(\*[0-9]*|\?)}/g, '}');
};

utils.groupRoutesByPath = function (routingTable) {
	const routesPerPath = _.reduce(routingTable, (memo, route) => {
		const path = utils.sanitizePath(route.path);
		const entry = memo[path] = memo[path] || [];
		entry.push(route);
		return memo;
	}, {});
	return routesPerPath;
};

utils.extractAPIKeys = function (routingTable) {
	const apiPrefixes = _.reduce(routingTable, (memo, route) => {
		const path = route.path;

		if (path !== '/') {
			const indexOfFirstSlash = path.indexOf('/', 1);
			const prefix = indexOfFirstSlash === -1 ? path.substr(0) : path.substring(0, indexOfFirstSlash);

			if (memo.indexOf(prefix) === -1) {
				memo.push(prefix);
			}
		}

		return memo;
	}, []);

	apiPrefixes.sort();

	return apiPrefixes;
};

const numberSuffix = /_([0-9]+)$/;

utils.generateFallbackName = function (modelName) {
	if (_.isEmpty(modelName)) {
		return null;
	}

	const match = numberSuffix.exec(modelName);

	if (match) {
		const count = parseInt(match[1], 10) + 1;
		modelName = modelName.replace(numberSuffix, `_${count}`);
	} else {
		modelName = `${modelName}_${2}`;
	}

	return modelName;
};

const primitiveSwaggerTypes = [ 'integer', 'number', 'string', 'boolean', 'string', 'date' ];
const supportedTypes = primitiveSwaggerTypes.concat('object', 'array');

utils.isPrimitiveSwaggerType = function (type) {
	return _.includes(primitiveSwaggerTypes, type);
};

utils.getMetaSwaggerType = function (schema) {
	return utils.getMeta(schema, 'swaggerType');
};

utils.getMetaSwaggerDefinition = function (schema) {
	return utils.getMeta(schema, 'swagger');
};

utils.isSupportedSchema = function (schema) {
	return !!schema && _.get(schema, '_flags.func') !== true && schema.isJoi === true && (utils.isSupportedType(utils.getPrimitiveType(schema)) || !!utils.getMetaSwaggerType(schema));
};

utils.isSupportedType = function (type) {
	return !!type && _.includes(supportedTypes, type);
};

utils.setNotEmpty = function (target, key, value) {
	if (!_.isEmpty(value) || _.isNumber(value)) {
		target[key] = value;
	}

	return target;
};

utils.generateRouteNickname = function (route) {
	return route.method + route.path.replace(/[\/|\{|}]/gi, '_');
};

utils.getSetting = function (schema, key) {
	if (schema && schema._settings && schema._settings[key]) {
		return schema._settings[key];
	}

	return undefined;
};

utils.getMeta = function (schema, key) {
	// merge meta objects - last one wins
	const meta = schema ? _.extend.apply(null, schema._meta) : undefined;
	// Still fallback to settings for joi <6
	return meta && !_.isUndefined(meta[key]) ? meta[key] : utils.getSetting(schema, key);
};

utils.generateName = function (schema) {
	return utils.getMeta(schema, 'className') || utils.generateNameFromSchema(schema);
};

utils.generateNameWithFallback = function (schema, definitions, definition) {
	let definitionName = utils.generateName(schema);

	if (definition && definitions) {
		while (definitions[definitionName] && !_.isEqual(definitions[definitionName], definition)) {
			definitionName = utils.generateFallbackName(definitionName);
		}
	}

	return definitionName;
};

utils.getSchemaDescription = function (schema) {
	return schema._description || undefined;
};

utils.getResponseDescription = function (schema) {
	return utils.getMeta(schema, 'description') || utils.getSchemaDescription(schema) || undefined;
};

utils.getPrimitiveType = function (schema) {
	const swaggerType = utils.getMetaSwaggerType(schema);

	if (swaggerType) {
		return swaggerType;
	}

	const isInteger = !!_.find(schema._tests, { name: 'integer' });
	return isInteger ? 'integer' : schema._type;
};

utils.findSchemaTest = function (schema, name) {
	const max = _.find(schema._tests, {
		name,
	});

	return max ? max.arg : undefined;
};

utils.parseBaseModelAttributes = function (schema) {
	const required = _.get(schema, '_flags.presence') === 'required';
	const description = schema._description;
	const defaultValue = _.get(schema, '_flags.default');
	const format = utils.getFormat(schema);
	const enumValues = _.get(schema, '_flags.allowOnly') === true ? _.get(schema, '_valids._set') : undefined;
	const collectionFormat = utils.getMeta(schema, 'collectionFormat');

	let pattern = _.find(schema._tests, { name: 'regex' });
	pattern = pattern ? pattern.arg.toString() : undefined;

	const baseModel = {
		required,
	};

	utils.setNotEmpty(baseModel, 'description', description);

	// TODO: Following working? Not covered by tests!
	utils.setNotEmpty(baseModel, 'default', defaultValue);
	utils.setNotEmpty(baseModel, 'format', format);
	utils.setNotEmpty(baseModel, 'pattern', pattern);
	utils.setNotEmpty(baseModel, 'enum', enumValues);
	utils.setNotEmpty(baseModel, 'collectionFormat', collectionFormat);
	const minValue = utils.findSchemaTest(schema, 'min');
	const maxValue = utils.findSchemaTest(schema, 'max');
	if (utils.getPrimitiveType(schema) === 'string') {
		utils.setNotEmpty(baseModel, 'minLength', minValue);
		utils.setNotEmpty(baseModel, 'maxLength', maxValue);
	} else {
		utils.setNotEmpty(baseModel, 'minimum', minValue);
		utils.setNotEmpty(baseModel, 'maximum', maxValue);
	}

	return baseModel;
};

utils.getFirstInclusionType = function (schema) {
	const inclusionTypes = _.get(schema, '_inner.inclusions');
	return _.first(inclusionTypes);
};

utils.getPathPrefix = function (path, n) {
	if (path) {
		n = n >= 1 ? n : 1;
		return path.substring(1, path.split('/', n + 1).join('/').length);
	}

	return null;
};

utils.getPathTags = function (path, pathLevel) {
	const tagPath = utils.getPathPrefix(path, pathLevel);
	return tagPath ? [ tagPath ] : [];
};

utils.getTags = function (settings) {
	return _.map(settings.tags, (value, key) => {
		if (typeof value === 'string') {
			return { name: key, description: value };
		}

		return value;
	});
};

utils.getFormat = function (schema) {
	const format = utils.getMeta(schema, 'format');

	if (format) {
		return format;
	}

	if (utils.getPrimitiveType(schema) === 'string') {
		if (_.find(schema._tests, { name: 'isoDate' })) {
			return 'datetime';
		}
		if (_.find(schema._tests, { name: 'email' })) {
			return 'email';
		}
	}

	return utils.getPrimitiveType(schema) === 'date' ? 'date-time' : undefined;
};

utils.mapSwaggerType = function (schema, type) {
	if (utils.getMetaSwaggerType(schema)) {
		return type;
	}

	switch (type) {
	case 'date':
		return 'string';
	default:
		return type;
	}
};
