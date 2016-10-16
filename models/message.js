
var neo4j       = require('../io/neo4j');
var random      = require('../lib/random');
var stripIndent = require('common-tags/lib/stripIndent');
var get         = require('lodash/get');
var markdown    = require('../lib/markdown');
var log         = require('../log')('models/message');

var QUERY_MESSAGE_TOPIC = stripIndent`
	MATCH (u:User { username: {username} })
	CREATE
		(m:Message {message}),
		(m)-[:CREATED_BY]->(u)
	RETURN m
`;

var QUERY_MESSAGE_REPLY = stripIndent`
	MATCH (u:User { username: {username} }), (pm:Message { id: {inReplyTo} })
	CREATE
		(m:Message {message}),
		(m)-[:CREATED_BY]->(u),
		(m)-[:IN_REPLY_TO]->(pm)
	RETURN m
`;


exports.MESSAGE_ID_LENGTH = 10;

exports.getById = function (id) {
	var query = stripIndent`
		MATCH (m:Message { id: {id} })
		RETURN m
	`;

	var data = { id };

	return neo4j.run(query, data)
		.then((results) => get(results, '[0].m.properties'));
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
	var private = options.private || false;

	// if no content was provided, generated it here
	// if message is a top level topic, strip out any markdown formatting.
	var content = options.content || (inReplyTo ? markdown(body).trim() : markdown.strip(body).trim());
	log.debug('Generated message content', content);

	if (!username || !body) return Promise.reject(new Error('models/message.create must have a username and body'));

	var id = random.id(exports.MESSAGE_ID_LENGTH);

	var message = {
		id,
		slug: options.slug || id,
		body,
		content,
		private: !!private,
		deleted: false,
		update_time: (new Date()).toISOString(),
		create_time: (new Date()).toISOString(),
	};

	var query = inReplyTo ? QUERY_MESSAGE_REPLY : QUERY_MESSAGE_TOPIC;
	var data = { username, message, inReplyTo };

	var transaction = neo4j.transaction();
	return transaction.run(query, data)
		.then((results) => transaction.commit().then(() => get(results, '[0].m.properties')));
};
