
var neo4j       = require('../io/neo4j');
var random      = require('../lib/random');
var stripIndent = require('common-tags/lib/stripIndent');
var markdown    = require('../lib/markdown');
var log         = require('../log')('models/message');
var linkNodes   = require('../lib/link-nodes');

var get = require('lodash/get');
var find = require('lodash/find');

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

exports.getById = function (id, options) {
	options = options || {};

	var childDepth = typeof options.depth === 'undefined' ? 1 : parseInt(options.depth, 10);
	var childQuery = '';
	if (childDepth) {
		childQuery = stripIndent`
			OPTIONAL MATCH
				(message)<-[rChild:IN_REPLY_TO*1..${childDepth}]-(child)-[rCAuthor:CREATED_BY]->(CAuthor)
			OPTIONAL MATCH
				(child)-[:DELETED_BY]->(cDeletedBy)
		`;
	}

	var parentDepth = typeof options.parents === 'undefined' ? 10 : parseInt(options.parents, 10);
	var parentQuery = '';
	if (parentDepth) {
		parentQuery = stripIndent`
			OPTIONAL MATCH (message)-[rParent:IN_REPLY_TO*1..${parentDepth}]->(parent)-[rPAuthor:CREATED_BY]->(pAuthor)
			OPTIONAL MATCH (parent)-[:DELETED_BY]->(pDeletedBy)
		`;
	}

	var query = stripIndent`
		MATCH (message:Message { id: {id} })-[rAuthor:CREATED_BY]->(author)
		OPTIONAL MATCH (message)-[:DELETED_BY]->(deletedBy)
		${childQuery}
		${parentQuery}
		RETURN *
		${childQuery && 'ORDER BY child.create_time'}
	`;

	var data = { id, childDepth, parentDepth };

	return neo4j.run(query, data)
		.then((results) => {
			linkNodes(results);
			var mainNode = get(results, '[0].message');
			if (!mainNode) return null;
			// console.log(require('util').inspect(results[0].message, { colors: true, depth: 6 }));

			var message = mainNode.properties;
			message.author = processMessageAuthor(mainNode);
			if (message.deleted) {
				message.deletedBy = processMessageDeletion(mainNode);
				message.body = '_[deleted]_';
				message.content = '<p><em>[deleted]</em></p>';
				message.author = '[deleted]';
			}
			processMessageParents(message, mainNode);
			processMessageChildren(message, mainNode);
			return message;
		});
};

function processMessageAuthor (node) {
	var authorNode = find(node.edgesTo, (rel) => rel.type === 'CREATED_BY');
	if (!authorNode) return null;
	authorNode = authorNode.endNode;
	return authorNode.properties.username;
}

function processMessageDeletion (node) {
	var deletionNode = find(node.edgesTo, (rel) => rel.type === 'DELETED_BY');
	if (!deletionNode) return null;
	deletionNode = deletionNode.endNode;
	return deletionNode.properties.username;
}

function processMessageParents (model, node) {
	var parentNode = find(node.edgesTo, (rel) => rel.type === 'IN_REPLY_TO');
	if (!parentNode) return;
	parentNode = parentNode.endNode;
	var parentModel = parentNode.properties;
	model.parent = parentModel;
	parentModel.author = processMessageAuthor(parentNode);
	if (parentModel.deleted) {
		parentModel.deletedBy = processMessageDeletion(parentNode);
		parentModel.body = '_[deleted]_';
		parentModel.content = '<p><em>[deleted]</em></p>';
		parentModel.author = '[deleted]';
	}
	processMessageParents(parentModel, parentNode);
}

function processMessageChildren (model, node) {
	model.replies = node.edgesFrom.map((rel) => {
		if (rel.type !== 'IN_REPLY_TO') return null;
		var childNode = rel.startNode;
		var childModel = childNode.properties;
		childModel.author = processMessageAuthor(childNode);
		processMessageChildren(childModel, childNode);
		if (childModel.deleted) {
			childModel.deletedBy = processMessageDeletion(childNode);
			childModel.body = '_[deleted]_';
			childModel.content = '<p><em>[deleted]</em></p>';
			childModel.author = '[deleted]';

			// if the child was deleted and has no children of its own, remove it
			if (!childModel.replies.length) {
				return null;
			}
		}
		return childModel;
	}).filter(Boolean);
}

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

exports.delete = function (id, username) {
	var query = stripIndent`
		MATCH (m:Message { id: {id} }), (u:User { username: {username} })
		SET m.deleted = {now}
		CREATE (m)-[:DELETED_BY { time: {now} }]->(u)
		RETURN m
	`;

	var data = {
		id,
		username,
		now: (new Date()).toISOString(),
	};

	return neo4j.run(query, data)
		.then((results) => get(results, '[0].m.properties'));

};
