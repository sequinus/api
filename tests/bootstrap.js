
var _          = require('lodash');
var Promise    = require('bluebird');
var neo4j      = require('../io/neo4j');
var app        = require('../index');
var random     = require('../lib/random');
var agent      = require('supertest-as-promised').agent(app);
var schemas    = require('../schemas');
var User       = require('../models/user');
var makeToken  = require('../lib/sign-jwt');
var usernames  = require('./usernames.json');

module.exports = exports = function bootstrap (options) {
	return neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => {
		var d = {};

		if (options.users) {
			d.users = exports.createUsers(options.users);
		}

		return Promise.props(d);
	});
};

exports.agent = agent;
exports.schemas = schemas;

exports.generateUsername = function () {
	return [
		usernames[random(usernames.length - 1)],
		usernames[random(usernames.length - 1)],
	].map(_.capitalize).join('');
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
