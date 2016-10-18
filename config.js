
var pkg = require('./package.json');
var rc   = require('rc');
var defaultsDeep = require('lodash/defaultsDeep');

var envName = process.env.NODE_ENV || 'development';

var appConfig = rc(pkg.name.replace(/[.-]/g, ''), {
	name: pkg.name,
	version: pkg.version,
	envName,
	isProd: envName === 'production',

	port: 3000,
	host: '0.0.0.0',

	logLevel: 'debug',

	jwt: {
		secret: 'This will be something else in prod',
		defaultExpire: '7d',
		noExpireSecret: 'Do not try to guess this, it will be different.',
		credentialsRequired: false,
	},

	markdown: {
		html: false,
		linkify: true,
	},

	io: {
		neo4j: {
			host: 'localhost',
			port: 7687,
			user: 'neo4j',
			pass: 'test',
		},
	},

	messages: {
		metadata: {
			maxEntries: 10, // no more than 10 metadata records per message
			maxSize: 5000, // no more than 5k data per metadata record
		},
	},
});

var envConfig = rc(pkg.name.replace(/[.-]/g, '') + '_' + envName, {});

module.exports = exports = defaultsDeep(envConfig, appConfig);

if (process.env.PORT) exports.port = process.env.PORT;
if (process.env.HOST) exports.host = process.env.HOST;
if (process.env.LOG_LEVEL) exports.logLevel = process.env.LOG_LEVEL;

if (!module.parent) {
	console.log(exports); // eslint-disable-line
}
