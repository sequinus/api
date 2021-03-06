process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

var Promise   = require('bluebird');
require('tapdate')();
var suite     = require('tapsuite');
var bootstrap = require('../../../bootstrap');
var neo4j     = require('../../../../io/neo4j');
var schemas   = require('../../../../schemas');
var Message   = require('../../../../models/message');
// var joi       = require('joi');


suite('models/message.getById', (s) => {

	s.after(() => neo4j.end());

	s.test('returns no children or parents by default', (t) => bootstrap({ depth: 3 }).then((conditions) => {
		var message = conditions.topics[0].replies[0];
		return Message.getById(message.id, { depth: 0, context: 0 })
			.then((result) => schemas.validate(result, schemas.model.message))
			.then((result) => {
				t.equal(result.id, message.id, 'target message is correct');
				t.equal(result.body, message.body, 'target message has correct body');
				t.equal(result.author, message.author, 'target message has correct author');
				t.notOk(result.parent, 'parent is absent');
				t.equal(result.level, 1, 'shows there is a parent above it');
				t.notOk(result.replies, 'replies are absent');
				t.equal(result.replyCount, 1, 'shows there is one reply');
			});
	}));

	s.test('returns all children and parents when asked for', (t) => bootstrap({ depth: 6 }).then((conditions) => {
		var message = conditions.tails[0].parent.parent.parent;
		return Promise.props({
			secondChild: bootstrap.createMessage(null, message),
		})
			.then(() => Message.getById(message.id, { depth: 10, context: 10 }))
			.then((result) => schemas.validate(result, schemas.model.message))
			.then((result) => {
				t.equal(result.id, message.id, 'main message is our target');
				t.equal(result.author, message.author, 'main message has correct author');
				t.equal(result.parent.id, message.parent.id, 'message parent is correct');
				t.equal(result.parent.author, message.parent.author, 'message parent author is correct');
				t.equal(result.parent.parent.id, message.parent.parent.id, 'message parent parent is correct');
				t.equal(result.parent.parent.author, message.parent.parent.author, 'message parent parent author is correct');
				t.equal(result.replies.length, 2, 'two replies');
				t.equal(result.replies[0].id, message.replies[0].id, 'first child is first child');
				t.equal(result.replies[0].author, message.replies[0].author, 'first child author matches');
				t.equal(result.replies[1].id, message.replies[1].id, 'second child is second child');
				t.equal(result.replies[1].author, message.replies[1].author, 'second child author matches');
				t.equal(result.replies[0].replies[0].id, message.replies[0].replies[0].id, 'first child\'s child is correct');
				t.equal(result.replies[0].replies[0].author, message.replies[0].replies[0].author, 'first child\'s child\'s author is correct');
			});
	}));

	s.test('returns metadata at all layers', (t) => bootstrap({ users: 3 }).then(() => {
		t.plan(9);
		var messageSettings = [
			{ metadata: [ { type: 'level', value: 1 } ] },
			{ metadata: [ { type: 'level', value: 2 } ] },
			{ metadata: [ { type: 'level', value: 3 } ] },
		];

		function assertMD (input, level) {
			if (t.equal(input.length, 1, `Level ${level} has metadata`)) {
				t.equal(input[0].type, 'level', `Level ${level} type correct`);
				t.equal(input[0].value, level, `Level ${level} value correct`);
			}
		}

		return (bootstrap.createChain(3, messageSettings)).then((tail) => {
			var message = tail.parent;
			return Message.getById(message.id, { depth: 10, context: 10 })
				.then((result) => schemas.validate(result, schemas.model.message))
				.then((result) => {
					assertMD(result.metadata, 2);
					assertMD(result.parent.metadata, 1);
					assertMD(result.replies[0].metadata, 3);
				});
		});
	}));

	s.test('retrieves a deleted message', (t) => bootstrap({ depth: 3, users: 1 }).then((conditions) => {
		var message = conditions.tails[0].parent;
		var deleteAs = conditions.users.slice(-1)[0];
		return Promise.props({
			deletion: Message.delete(message.id, deleteAs.username),
		})
			.then(() => Message.getById(message.id, { depth: 2, context: 10 }))
			.then((result) => schemas.validate(result, schemas.model.message))
			.then((result) => {
				t.equal(result.id, message.id, 'message is our target');
				t.equal(result.author, '[deleted]', 'author shows deletion');
				t.equal(result.body, '_[deleted]_', 'body shows deletion');
				t.equal(result.content, '<p><em>[deleted]</em></p>', 'content shows deletion');
				t.ok(result.deleted, 'deleted is no longer false');
				t.ok(result.parent.id, 'still shows parent message');
				t.equal(result.replies.length, 1, 'still shows child messages');
			});
	}));

	s.test('retrieves a message with a deleted child', (t) => bootstrap({ depth: 3, users: 1 }).then((conditions) => {
		var message = conditions.tails[0].parent;
		var deleteAs = conditions.users.slice(-1)[0];
		return Promise.props({
			deletion: Message.delete(message.replies[0].id, deleteAs.username),
		})
			.then(() => Message.getById(message.id, { depth: 2, context: 10 }))
			.then((result) => schemas.validate(result, schemas.model.message))
			.then((result) => {
				t.equal(result.id, message.id, 'target message is correct');
				t.equal(result.body, message.body, 'target message has correct body');
				t.equal(result.author, message.author, 'target message has correct author');
				t.equal(result.parent.id, message.parent.id, 'message parent is correct');
				t.equal(result.parent.body, message.parent.body, 'message parent body is correct');
				t.equal(result.replies.length, 0, 'message shows no replies');
			});
	}));

	s.test('retrieves a message with a deleted child that has replies', (t) => bootstrap({ depth: 3, users: 1 }).then((conditions) => {
		var message = conditions.topics[0];
		var deleteAs = conditions.users.slice(-1)[0];
		return Promise.props({
			deletion: Message.delete(message.replies[0].id, deleteAs.username),
		})
			.then(() => Message.getById(message.id, { depth: 2, context: 10 }))
			.then((result) => schemas.validate(result, schemas.model.message))
			.then((result) => {
				t.equal(result.id, message.id, 'target message is correct');
				t.equal(result.body, message.body, 'target message has correct body');
				t.equal(result.author, message.author, 'target message has correct author');
				t.notOk(result.parent, 'parent is absent');
				t.equal(result.replies.length, 1, 'message still shows the reply');
				t.equal(result.replies[0].body, '_[deleted]_', 'child shows deleted content');
				t.equal(result.replies[0].author, '[deleted]', 'child shows deleted author');
				t.equal(result.replies[0].replies[0].id, conditions.tails[0].id, 'child\'s child remains');
				t.equal(result.replies[0].replies[0].author, conditions.tails[0].author, 'and is untouched');
			});
	}));
});
