
var neo4j       = require('../io/neo4j');
var random      = require('../lib/random');
var stripIndent = require('common-tags/lib/stripIndent');
var get         = require('lodash/get');
var markdown    = require('../lib/markdown');
var log         = require('../log')('models/message');

var QUERY_MESSAGE_TOPIC = stripIndent`
	MATCH (author:User { username: {username} })
	CREATE
		(message:Message {message}),
		(message)-[:CREATED_BY]->(author)
	RETURN message, author
`;

var QUERY_MESSAGE_REPLY = stripIndent`
	MATCH (author:User { username: {username} }), (parent:Message { id: {inReplyTo} })
	CREATE
		(message:Message {message}),
		(message)-[:CREATED_BY]->(author),
		(message)-[:IN_REPLY_TO]->(parent)
	RETURN message, author
`;


exports.MESSAGE_ID_LENGTH = 10;

exports.getById = function (id) {
	var query = stripIndent`
		MATCH
			(message:Message { id: {id} }),
			(message)-[:CREATED_BY]->(author)
		OPTIONAL MATCH
			(message)-[:IN_REPLY_TO]->(parent),
			(message)-[:DELETED_BY]->(deletedBy)
		RETURN message, author, deletedBy, parent
	`;

	var data = { id };

	return neo4j.run(query, data)
		.then((results) => {
			var message = get(results, '[0].message.properties');
			if (!message) return null;

			message.author = get(results, '[0].author.properties.username');

			return message;
		});
};

exports.getBySlug = function (slug) {
	var query = stripIndent`
		MATCH (m:Message { slug: {slug} })
		RETURN m
	`;

	var data = { slug };

	return neo4j.run(query, data)
		.then((results) => get(results, '[0].m.properties'));
};


exports.create = function (options) {
	var username = options.username;
	var body = options.body;
	var inReplyTo = options.inReplyTo;

	// if no content was provided, generated it here
	// if message is a top level topic, strip out any markdown formatting.
	var content = options.content || (inReplyTo ? markdown(body).trim() : markdown.strip(body).trim());
	log.debug('Generated message content', content);

	if (!username || !body) return Promise.reject(new Error('models/message.create must have a username and body'));

	var id = random.id(exports.MESSAGE_ID_LENGTH);

	var properties = {
		id,
		slug: options.slug || id,
		body,
		content,
		private: !!options.private,
		hidden: !!options.hidden,
		deleted: false,
		update_time: (new Date()).toISOString(),
		create_time: (new Date()).toISOString(),
	};

	var query = inReplyTo ? QUERY_MESSAGE_REPLY : QUERY_MESSAGE_TOPIC;
	var data = { username, message: properties, inReplyTo };

	var transaction = neo4j.transaction();
	return transaction.run(query, data)
		.then((results) => transaction.commit().then(() => {
			var message = get(results, '[0].message.properties');
			if (!message) return null;

			message.author = get(results, '[0].author.properties.username');

			return message;
		}));
};
};
