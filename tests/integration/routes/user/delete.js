process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

var Promise   = require('bluebird');
require('tapdate')();
var suite     = require('../../../suite');
var neo4j     = require('../../../../io/neo4j');
var app       = require('../../../../index');
var agent     = require('supertest-as-promised').agent(app);
var joi       = require('joi');
var schemas   = require('../../../../schemas');
var User      = require('../../../../models/user');
var makeToken = require('../../../../lib/sign-jwt');


var DATE_TOLERANCE = 5;
var ERROR_RESPONSE_SCHEMA = schemas.response.error;
var VALID_RESPONSE_SCHEMA = joi.object().keys({
	message: joi.string().required(),
});

suite('DELETE /user', (s) => {
	var USERNAME = 'testuser';
	var PASSWORD = 'password';
	var TOKEN;

	s.after(() => neo4j.end());

	s.before(() => makeToken(USERNAME).then((tok) => { TOKEN = tok; }));

	// purge the database before each test
	s.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	s.test('delete a user', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.delete('/user/' + USERNAME)
				.set('Authorization', `Bearer ${TOKEN}`)
				.then((res) => {
					t.equal(res.status, 202, 'http accepted');
					return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
				})
			)
			.then(() => neo4j.run('MATCH (u) OPTIONAL MATCH (u)-[r]-(p) RETURN *'))
			.then((results) => {
				t.notOk(results[0].p, 'No password exists');
				t.notOk(results[0].r, 'No password is associated');
				t.equal(results[0].u.properties.username.indexOf('$'), 8, 'Original username is now deprecated');
				t.equal(results[0].u.properties.displayname, '[deleted]', 'Display name now shows deleted');
				t.dateNear(results[0].u.properties.deleted, new Date(), DATE_TOLERANCE, 'deleted date is set');
				// console.log(require('util').inspect(results, { colors: true, depth: 6 }));
			})
	);

	s.test('404s when a user does not exist', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.delete('/user/nobody')
				.set('Authorization', `Bearer ${TOKEN}`)
				.then((res) => {
					t.equal(res.status, 404, 'http not found');
					return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
				})
			)
	);

	s.test('404s when a user has already been deleted', (t) =>
		Promise.join(
			User.createWithPassword('notme', PASSWORD),
			User.createWithPassword(USERNAME, PASSWORD),
			() => User.delete('notme')
		)
			.then((deletedUser) => agent
				.get('/user/' + deletedUser.username)
				.set('Authorization', `Bearer ${TOKEN}`)
				.then((res) => {
					t.equal(res.status, 404, 'http not found');
					return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
				})
			)
	);

	s.test('401s if no auth token is provided', (t) =>
		agent.delete('/user/nobody')
			.then((res) => {
				t.equal(res.status, 401, 'http unauthorized');
				return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
			})
	);

	s.test('403s if requesting user is not the account being deleted', (t) =>
		Promise.join(
			User.createWithPassword('notme', PASSWORD),
			User.createWithPassword(USERNAME, PASSWORD),
			() => agent
				.delete('/user/notme')
				.set('Authorization', `Bearer ${TOKEN}`)
				.then((res) => {
					t.equal(res.status, 403, 'http unauthorized');
					return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
				})
			)
		);

});
