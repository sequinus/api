
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

function append (target, source) {
	Array.prototype.push.apply(target, source);
}

var conditions;

module.exports = exports = function bootstrap (options) {
	conditions = {
		users: [],
		topics: [],
		tails: [],
	};

	options = _.defaults(options, {
		users: 0,
		topics: 0,
		topicConfig: {},
		depth: 0,
		messageConfigs: [],
	});

	return neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => {
		var d = {};

		var userCount = options.users || 0;
		if (options.depth) {
			userCount += (options.depth || 0) * (options.topics || 1);
		} else if (options.topics) {
			userCount += options.topics;
		}

		if (userCount) {
			d.users = exports.createUsers(userCount);
		}

		if (options.topics) {
			d.topics = d.users.then(() => exports.createTopics(options.topics));
		}

		if (options.chains || options.depth) {
			d.tails = d.users.then(() => Promise.all(
				_.times(options.chains || 1, () => exports.createChain(options.depth))
			));
		}

		return Promise.props(d);
	}).then(() => conditions);
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
	)).then((users) => {
		if (conditions) {
			append(conditions.users, users);
		}
		return users;
	});
};

exports.createMessage = function (user, parent, settings) {
	var username;
	if (_.isObjectLike(user) && user.username) {
		username = user.username;
	} else if (typeof user === 'string') {
		username = user;
	} else if (typeof user === 'number' && conditions) {
		username = conditions.users[user % (conditions.users.length - 1)].username;
	} else if (conditions) {
		username = random.from(conditions.users).username;
	} else {
		return Promise.reject(new Error('Bootstrap could not find a user to create a message for'));
	}

	var inReplyTo;
	if (_.isObjectLike(parent)) {
		inReplyTo = parent.id;
	} else if (typeof parent === 'string') {
		inReplyTo = parent;
	}

	var opts = Object.assign({
		username,
		body: lorem(),
		inReplyTo,
	}, settings);

	return Message.create(opts).then((message) => {
		if (_.isObjectLike(parent)) {
			parent.replies = parent.replies || [];
			parent.replies.push(message);
			message.parent = parent;
		}
		return message;
	});
};

exports.createTopics = function (count, settings) {
	var pTopics = _.times(count, (i) => exports.createMessage(i, null, settings && settings[i]));

	return Promise.all(pTopics)
		.then((topics) => {
			if (conditions) {
				append(conditions.topics, topics);
				append(conditions.tails, topics);
			}
			return topics;
		});
};

exports.createChain = function (depth, messages, parent) {
	var tail;

	if (typeof parent === 'object') {
		tail = parent;
	} else if (typeof parent === 'string') {
		tail = Message.getById(parent);
	}

	function addMessage (parent, level) {
		if (level + 1 > depth) return Promise.resolve(parent);
		return exports.createMessage(null, parent, messages && messages[level])
			.then((message) => {
				if (!parent) conditions.topics.push(message);
				return addMessage(message, level + 1);
			});
	}

	return Promise.join(tail, 0, addMessage)
		.then((tail) => {
			if (conditions) {
				var i = conditions.tails.indexOf(parent);
				if (i > -1) {
					conditions.tails[i] = tail;
				} else {
					conditions.tails.push(tail);
				}
			}
			return tail;
		});

};
