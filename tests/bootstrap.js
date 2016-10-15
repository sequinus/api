
var _          = require('lodash');
var Promise    = require('bluebird');
var neo4j      = require('../io/neo4j');
var app        = require('../index');
var random     = require('../lib/random');
var agent      = require('supertest-as-promised').agent(app);
var schemas    = require('../schemas');
var User       = require('../models/user');
var Message    = require('../models/message');
var makeToken  = require('../lib/sign-jwt');
var usernames  = require('./usernames.json');
var lorem      = require('lorem-ipsum');

module.exports = exports = function bootstrap (options) {
	options = options || {};
	return neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => {
		var d = {};

		var needUsers = options.users || options.topics;

		if (needUsers) {
			d.users = exports.createUsers(options.users);
		}

		if (options.topics) {
			d.topics = Promise.join(options.topics, d.users, exports.createTopics);
		}

		return Promise.props(d);
	});
};

exports.agent = agent;
exports.schemas = schemas;
exports.inspect = (value, depth) => console.log(require('util').inspect(value, { colors: true, depth: depth || 6 })); // eslint-disable-line no-console

exports.generateUsername = function () {
	return _.times(2, () => usernames[random(usernames.length - 1)])
		.map(_.capitalize).join('');
};

exports.createUsers = function (count) {
	var usernames = _.times(count, exports.generateUsername);
	return Promise.map(usernames, (username) => Promise.join(
		User.createWithPassword(username, 'password'),
		makeToken(username),
		(user, token) => {
			user.token = token;
			return user;
		}
	));
};

exports.createTopics = function (count, users) {
	var pUserSet = _.times(count, (i) => users[ i % (users.length - 1)]);

	return Promise.map(pUserSet, (user) => Message.create({
		username: user.username,
		body: lorem(),
	}));
};
