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
				t.equal(res.status, 202, 'http accepted');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
			.then(() => neo4j.run('MATCH (m:Message)-[r]->(u:User) RETURN *'))
			.then((results) => {
				results = results[0];
				t.equal(results.m.properties.body, 'Hello, **this** is a _new_ message.\n\nThis [message](http://google.com) should become a topic.', 'message body is trimmed');
				t.equal(results.m.properties.content, 'Hello, this is a new message.\nThis message should become a topic.', 'message content contains no html');
				t.dateNear(results.m.properties.create_time, new Date(), DATE_TOLERANCE, 'create time is set');
				t.dateNear(results.m.properties.update_time, new Date(), DATE_TOLERANCE, 'update time is set');
				t.dateSame(results.m.properties.create_time, results.m.properties.update_time, 'second', 'create time and update time are identical');
				t.equal(results.r.type, 'CREATED_BY', 'CREATED_BY relationship exists');
				t.equal(results.r.start.low, results.m.identity.low, 'between the message');
				t.equal(results.r.end.low, results.u.identity.low, 'and the user');
				t.equal(results.u.properties.username, user.username, 'bound to the correct user');
				// console.log(require('util').inspect(results, { colors: true, depth: 6 }));
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
							path: 'body',
						},
						{
							title: 'Request data is missing or in the incorrect format.',
							detail: '"body" length must be at least 1 characters long',
							path: 'body',
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


});
