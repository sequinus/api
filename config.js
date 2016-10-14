
var pkg = require('./package.json');
var rc   = require('rc');

module.exports = exports = rc(pkg.name, {
	name: pkg.name,
	version: pkg.version,

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
});

if (process.env.PORT) exports.port = process.env.PORT;
if (process.env.HOST) exports.host = process.env.HOST;
if (process.env.LOG_LEVEL) exports.logLevel = process.env.LOG_LEVEL;
