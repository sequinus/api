
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
	options = _.defaults(options, {
		users: 0,
		topics: 0,
		topicConfig: {},
		depth: 0,
		messageConfigs: [],
	});

	return neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => {
		var d = {};

		var needUsers = options.users || 0;
		if (options.depth) {
			needUsers += (options.depth || 0) * (options.topics || 1);
		} else if (options.topics) {
			needUsers += options.topics;
		}


		if (needUsers) {
			d.users = exports.createUsers(needUsers);
		}

		if (options.topics || options.depth) {
			d.topics = Promise.join(
				options.topics || (options.depth && 1),
				d.users,
				options.topicConfig,
				exports.createTopics
			);
		}

		if (options.depth) {
			d.tails = Promise.join(d.users, d.topics, (users, topics) => Promise.map(topics, (topic) => {
				function addMessage (parent, level) {
					if (level > options.depth - 1) return Promise.resolve(parent);
					return Message.create(
						Object.assign({
							username: users.shift().username,
							body: lorem(),
							inReplyTo: parent.id,
						}, options.messageConfigs[level])
					).then((message) => {
						parent.replies = [ message ];
						message.parent = parent;
						return addMessage(message, level + 1);
					});
				}

				return addMessage(topic, 1);
			}));
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

exports.createTopics = function (count, users, opts) {
	var pUserSet = _.times(count, (i) => users[ i % (users.length - 1)]);

	return Promise.map(pUserSet, (user) => Message.create(Object.assign({
		username: user.username,
		body: lorem(),
	}, opts)));
};
