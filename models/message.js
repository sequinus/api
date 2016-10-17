
var neo4j       = require('../io/neo4j');
var random      = require('../lib/random');
var stripIndent = require('common-tags/lib/stripIndent');
var markdown    = require('../lib/markdown');
var log         = require('../log')('models/message');
var linkNodes   = require('../lib/link-nodes');

var each = require('lodash/each');
var flatten = require('lodash/flatten');
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

	var childSort   = { oldest: 'ASC', newest: 'DESC' }[options.sortReplies] || '';
	var childLimit  = typeof options.maxReplies === 'undefined'  ? 20 : parseInt(options.maxReplies, 10);
	var childSkip   = typeof options.skipReplies === 'undefined' ? 0 : parseInt(options.skipReplies, 10);

	var childDepth  = typeof options.depth === 'undefined'   ?  1 : parseInt(options.depth, 10);
	var parentDepth = typeof options.context === 'undefined' ? 10 : parseInt(options.context, 10);

	var mainQuery = stripIndent`
		MATCH (message:Message { id: {id} })-[rmAuthor:CREATED_BY]->(mAuthor)
		OPTIONAL MATCH (message)-[rmDeletedBy:DELETED_BY]->(mDeletedBy)
		OPTIONAL MATCH (message)<-[:IN_REPLY_TO]-(child)
		OPTIONAL MATCH (message)-[:IN_REPLY_TO*1..]->(parent)
		RETURN message, rmAuthor, mAuthor, rmDeletedBy, mDeletedBy, count(child) as childCount, count(parent) as parentCount
	`;

	var parentQuery = stripIndent`
		MATCH (message:Message { id: {id} })-[rParent:IN_REPLY_TO*1..${parentDepth}]->(parent)-[rpAuthor:CREATED_BY]->(pAuthor)
		OPTIONAL MATCH (parent)-[rpDeletedBy:DELETED_BY]->(pDeletedBy)
		RETURN rParent, parent, rpAuthor, pAuthor, rpDeletedBy, pDeletedBy
	`;

	var childQuery = stripIndent`
		MATCH
			(message:Message { id: {id} })<-[rChild:IN_REPLY_TO*1..${childDepth}]-(child)-[rcAuthor:CREATED_BY]->(cAuthor)
		OPTIONAL MATCH
			(child)-[rcDeletedBy:DELETED_BY]->(cDeletedBy)
		RETURN rChild, child, rcAuthor, cAuthor, rcDeletedBy, cDeletedBy
		ORDER BY child.create_time ${childSort} SKIP ${childSkip} LIMIT ${childLimit}
	`;

	var data = { id };

	var pQueries = [ neo4j.run(mainQuery, data) ];
	if (childDepth) pQueries.push(neo4j.run(childQuery, data));
	if (parentDepth) pQueries.push(neo4j.run(parentQuery, data));

	return Promise.all(pQueries)
		.then(flatten)
		.then((results) => {
			linkNodes(results);
			// console.log(require('util').inspect(results[0], { colors: true, depth: 6 }));

			// find our prime message node
			var mainNode;
			each(results, (row) => {
				// if the message is the correct id and it has been altered by linkNodes, it's our message
				if (row.message && row.message.properties.id === id && row.message.edgesTo) {
					mainNode = row.message;
					return false;
				}
			});
			if (!mainNode) return null;

			var childCount = get(results, '[0].childCount');
			childCount = childCount ? childCount.toInt() : 0;

			var parentCount = get(results, '[0].parentCount');
			parentCount = parentCount ? parentCount.toInt() : 0;

			var message = mainNode.properties;
			message.author = processMessageAuthor(mainNode);
			message.level = parentCount;
			message.replyCount = childCount;
			if (message.deleted) {
				message.deletedBy = processMessageDeletion(mainNode);
				message.body = '_[deleted]_';
				message.content = '<p><em>[deleted]</em></p>';
				message.author = '[deleted]';
			}
			if (parentDepth) processMessageParents(message, mainNode);
			if (childDepth) processMessageChildren(message, mainNode);
			else {
				message.replies = undefined;
			}
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
