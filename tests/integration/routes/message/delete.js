process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

// var Promise   = require('bluebird');
require('tapdate')();
var suite     = require('../../../suite');
var bootstrap = require('../../../bootstrap');
var neo4j     = require('../../../../io/neo4j');
var agent     = bootstrap.agent;
var schemas   = require('../../../../schemas');
var Message   = require('../../../../models/message');
var route     = require('../../../../routes/message/delete');

var DATE_TOLERANCE = 5;

suite('DELETE /message/:messageid', (s) => {

	s.after(() => neo4j.end());

	s.test('delete a message by id', (t) => bootstrap({ depth: 1 }).then((conditions) => {
		var message = conditions.topics[0];
		var user = conditions.userMap[message.author];

		return agent
			.delete(`/message/${message.id}`)
			.set('Authorization', `Bearer ${user.token}`)
			.then((res) => {
				t.equal(res.status, 202, 'http accepted');
				t.equal(res.body.success, `Message "${message.id}" has been deleted.`, 'success message');
				return schemas.validate(res.body, route.schema.responses[202]);
			})
			.then(() => neo4j.run(
				'MATCH (message:Message { id: {id} }) OPTIONAL MATCH (message)-[:DELETED_BY]-(mDeletedBy) RETURN message, mDeletedBy',
				{ id: message.id }
			))
			.then((results) => {
				t.dateNear(results[0].message.properties.deleted, new Date(), DATE_TOLERANCE, 'deleted date is set');
				t.equal(results[0].mDeletedBy.properties.username, user.username, 'shows deleted by user');
				// console.log(require('util').inspect(results, { colors: true, depth: 6 }));
			});
	}));

	s.test('404s when the message does not exist', (t) => bootstrap({ users: 1 }).then((conditions) => {
		var user = conditions.users[0];
		return agent
			.delete('/message/0000000000')
			.set('Authorization', `Bearer ${user.token}`)
			.then((res) => {
				t.equal(res.status, 404, 'http not found');
				return schemas.validate(res.body, schemas.response.error);
			});
	}));

	s.test('404s when a message has already been deleted', (t) => bootstrap({ depth: 1 }).then((conditions) => {
		var message = conditions.topics[0];
		var user = conditions.users[0];
		return Message.delete(message.id, user.username).then(() => agent
			.delete('/message/' + message.id)
			.set('Authorization', `Bearer ${user.token}`)
			.then((res) => {
				t.equal(res.status, 404, 'http not found');
				return schemas.validate(res.body, schemas.response.error);
			}));
	}));

	s.test('401s if no auth token is provided', (t) =>
		agent.delete('/message/nobody')
			.then((res) => {
				t.equal(res.status, 401, 'http unauthorized');
				return schemas.validate(res.body, schemas.response.error);
			})
	);

	s.test('403s if requesting user is not the author of the message being deleted', (t) => bootstrap({ depth: 1, users: 1 }).then((conditions) => {
		var message = conditions.topics[0];
		var user = conditions.users.slice(-1)[0];

		return agent
			.delete('/message/' + message.id)
			.set('Authorization', `Bearer ${user.token}`)
			.then((res) => {
				t.equal(res.status, 403, 'http unauthorized');
				return schemas.validate(res.body, schemas.response.error);
			});

	}));

});
