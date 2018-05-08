process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

// var Promise   = require('bluebird');
require('tapdate')();
var suite     = require('tapsuite');
var bootstrap = require('../../../bootstrap');
var neo4j     = require('../../../../io/neo4j');
var agent     = bootstrap.agent;
var schemas   = require('../../../../schemas');
var route     = require('../../../../routes/message/get');

suite('GET /message', (s) => {

	s.after(() => neo4j.end());

	s.test('get a message by id without auth, no query args', (t) => bootstrap({ depth: 3 }).then((conditions) => {
		var message = conditions.topics[0].replies[0];
		return agent
			.get(`/message/${message.id}`)
			.then((res) => {
				t.equal(res.status, 200, 'http ok');
				return schemas.validate(res.body, route.schema.responses[200]);
			})
			.then((body) => {
				t.equal(body.message.id, message.id, 'got back correct message');
				t.notOk(body.message.parent, 'parent is absent');
				t.notOk(body.message.replies, 'replies are absent');
			});
	}));

	s.test('get a message by id without auth, with context and depth', (t) => bootstrap({ depth: 3 }).then((conditions) => {
		var message = conditions.topics[0].replies[0];
		return agent
			.get(`/message/${message.id}`)
			.query({
				context: 10,
				depth: 10,
			})
			.then((res) => {
				t.equal(res.status, 200, 'http ok');
				return schemas.validate(res.body, route.schema.responses[200]);
			})
			.then((body) => {
				t.equal(body.message.id, message.id, 'got back correct message');
				t.equal(body.message.parent.id, message.parent.id, 'parent is correct');
				t.equal(body.message.replies.length, 1, 'has one reply');
				t.equal(body.message.replies[0].id, message.replies[0].id, 'reply is correct');
			});
	}));

});
