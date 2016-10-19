process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

// var Promise   = require('bluebird');
require('tapdate')();
var suite     = require('../../../suite');
var bootstrap = require('../../../bootstrap');
var neo4j     = require('../../../../io/neo4j');
var agent     = bootstrap.agent;
var joi       = require('joi');
var schemas   = require('../../../../schemas');

var DATE_TOLERANCE = 5;
var VALID_RESPONSE_SCHEMA = joi.object().keys({
	message: schemas.model.message,
});

suite('POST /message', (s) => {

	s.after(() => neo4j.end());

	s.test('post a new topic', (t) => bootstrap({ users: 2 }).then((conditions) => {
		var user = conditions.users[1];
		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({
				body: ' Hello, **this** is a _new_ message.\n\nThis [message](http://google.com) should become a topic. ',
			})
			.then((res) => {
				t.equal(res.status, 201, 'http created');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
			.then(() => neo4j.run('MATCH (m:Message)-[r]->(u:User) RETURN *'))
			.then((results) => {
				results = results[0];
				t.equal(results.m.properties.body, 'Hello, **this** is a _new_ message.\n\nThis [message](http://google.com) should become a topic.', 'message body is trimmed');
				t.equal(results.m.properties.content, 'Hello, this is a new message.\n\nThis message should become a topic.', 'message content contains no html');
				t.dateNear(results.m.properties.create_time, new Date(), DATE_TOLERANCE, 'create time is set');
				t.dateNear(results.m.properties.update_time, new Date(), DATE_TOLERANCE, 'update time is set');
				t.dateSame(results.m.properties.create_time, results.m.properties.update_time, 'second', 'create time and update time are identical');
				t.equal(results.r.type, 'CREATED_BY', 'CREATED_BY relationship exists');
				t.equal(results.r.start.low, results.m.identity.low, 'between the message');
				t.equal(results.r.end.low, results.u.identity.low, 'and the user');
				t.equal(results.u.properties.username, user.username, 'bound to the correct user');
			});
	}));

	s.test('post a new topic with a body of only whitespace', (t) => bootstrap({ users: 1 }).then((conditions) => {
		var user = conditions.users[0];
		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({
				body: '    ',
			})
			.then((res) => {
				t.equal(res.status, 400, 'http bad request');
				t.deepEqual(res.body, {
					errors: [
						{
							title: 'Request data is missing or in the incorrect format.',
							detail: '"body" is not allowed to be empty',
							path: 'body.body',
						},
						{
							title: 'Request data is missing or in the incorrect format.',
							detail: '"body" length must be at least 1 characters long',
							path: 'body.body',
						},
					],
				}, 'correct error output');
				return schemas.validate(res.body, schemas.response.validationError);
			})
			.then(() => neo4j.run('MATCH (m:Message) RETURN m'))
			.then((results) => {
				t.equal(results.length, 0, 'No messages were created');
			});
	}));

	s.test('post a new topic with no body', (t) => bootstrap({ users: 1 }).then((conditions) => {
		var user = conditions.users[0];
		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({})
			.then((res) => {
				t.equal(res.status, 400, 'http bad request');
				t.deepEqual(res.body, {
					errors: [
						{
							title: 'Request data is missing or in the incorrect format.',
							detail: '"body" is required',
							path: 'body.body',
						},
					],
				}, 'correct error output');
				return schemas.validate(res.body, schemas.response.validationError);
			})
			.then(() => neo4j.run('MATCH (m:Message) RETURN m'))
			.then((results) => {
				t.equal(results.length, 0, 'No messages were created');
			});
	}));

	s.test('post a message under a topic', (t) => bootstrap({ users: 2, topics: 1 }).then((conditions) => {
		var user = conditions.users[0];
		var topic = conditions.topics[0];

		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({
				body: ' Hello, **this** is a _new_ message.\n\nThis [message](http://google.com) should become a top level post. ',
				inReplyTo: topic.id,
			})
			.then((res) => {
				t.equal(res.status, 201, 'http created');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
			.then(() => neo4j.run('MATCH (m:Message)-[r]->(t:Message), (m)-[c]->(u:User) RETURN m, r, t, c, u'))
			.then((results) => {
				results = results[0];
				t.equal(results.m.properties.body, 'Hello, **this** is a _new_ message.\n\nThis [message](http://google.com) should become a top level post.', 'message body is trimmed');
				t.equal(results.m.properties.content, '<p>Hello, <strong>this</strong> is a <em>new</em> message.</p>\n<p>This <a href="http://google.com" target="_blank">message</a> should become a top level post.</p>');
				t.dateNear(results.m.properties.create_time, new Date(), DATE_TOLERANCE, 'create time is set');
				t.dateNear(results.m.properties.update_time, new Date(), DATE_TOLERANCE, 'update time is set');
				t.dateSame(results.m.properties.create_time, results.m.properties.update_time, 'second', 'create time and update time are identical');
				t.equal(results.r.type, 'IN_REPLY_TO', 'IN_REPLY_TO relationship exists');
				t.equal(results.r.start.low, results.m.identity.low, 'between the message');
				t.equal(results.r.end.low, results.t.identity.low, 'and the topic');
				t.equal(results.c.type, 'CREATED_BY', 'CREATED_BY relationship exists');
				t.equal(results.c.start.low, results.m.identity.low, 'between the message');
				t.equal(results.c.end.low, results.u.identity.low, 'and the user');
				t.equal(results.u.properties.username, user.username, 'bound to the correct user');

			});
	}));

	s.test('post a reply to a message', (t) => bootstrap({ depth: 2, users: 1 }).then((conditions) => {
		var user = conditions.users[0];
		var parentMessage = conditions.tails[0];
		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({
				body: '👻 This message contains emoji and a link. http://twitter.com',
				inReplyTo: parentMessage.id,
			})
			.then((res) => {
				t.equal(res.status, 201, 'http created');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
			.then(() => neo4j.run('MATCH (t:Message)<--(p:Message)<-[r]-(m:Message), (m)-[c]->(u:User) RETURN m, r, p, c, u'))
			.then((results) => {
				results = results[0];
				t.equal(results.m.properties.body, '👻 This message contains emoji and a link. http://twitter.com', 'message body is trimmed');
				t.equal(results.m.properties.content, '<p>\uD83D\uDC7B This message contains emoji and a link. <a href="http://twitter.com" target="_blank">http://twitter.com</a></p>');
				t.dateNear(results.m.properties.create_time, new Date(), DATE_TOLERANCE, 'create time is set');
				t.dateNear(results.m.properties.update_time, new Date(), DATE_TOLERANCE, 'update time is set');
				t.dateSame(results.m.properties.create_time, results.m.properties.update_time, 'second', 'create time and update time are identical');
				t.equal(results.r.type, 'IN_REPLY_TO', 'IN_REPLY_TO relationship exists');
				t.equal(results.r.start.low, results.m.identity.low, 'between the message');
				t.equal(results.r.end.low, results.p.identity.low, 'and the topic');
				t.equal(results.p.properties.id, parentMessage.id, 'parent message is correct');
				t.equal(results.c.type, 'CREATED_BY', 'CREATED_BY relationship exists');
				t.equal(results.c.start.low, results.m.identity.low, 'between the message');
				t.equal(results.c.end.low, results.u.identity.low, 'and the user');
				t.equal(results.u.properties.username, user.username, 'bound to the correct user');

			});
	}));

	s.test('post a topic with metadata', (t) => bootstrap({ users: 1 }).then((conditions) => {
		var user = conditions.users[0];
		return agent
			.post('/message')
			.set('Authorization', `Bearer ${user.token}`)
			.send({
				body: 'KITTIES!',
				metadata: [
					{ type: 'image',       value: { url: 'https://placekitten.com/500/500' } },
					{ type: 'description', value: 'Aww, it\'s a kitten.' },
				],
			})
			.then((res) => {
				t.equal(res.status, 201, 'http created');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
			.then(() => neo4j.run('MATCH (m:Message)<-[r:METADATA_FOR]-(md:Metadata) RETURN md ORDER BY md.index'))
			.then((results) => {
				results = results.map((row) => row.md.properties);
				if (t.equal(results.length, 2, 'found two metadata entries')) {
					t.equal(results[0].type, 'image', 'first item is an image');
					t.equal(results[1].type, 'description', 'second item is a description');
					t.ok(results[0].json, 'first item is json encoded');
					t.deepEqual(results[0].value, '{"url":"https://placekitten.com/500/500"}', 'image contents match');
					t.deepEqual(results[1].value, 'Aww, it\'s a kitten.', 'description contents match');

					t.dateNear(results[0].create_time, new Date(), DATE_TOLERANCE, 'first item create time is set');
					t.dateNear(results[1].create_time, new Date(), DATE_TOLERANCE, 'second item create time is set');
				}
			});
	}));

});
