process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

var Promise = require('bluebird');
var test    = require('tap').test;
var neo4j   = require('../../../../io/neo4j');
var app     = require('../../../../index');
var agent   = require('supertest-as-promised').agent(app);
var joi     = require('joi');
var schemas = require('../../../../schemas');
var User    = require('../../../../models/user');

require('tapdate')();

var ERROR_RESPONSE_SCHEMA = schemas.response.error;

var VALID_RESPONSE_SCHEMA = joi.object().keys({
	user: schemas.model.user.required(),
});

test('GET /user', (t) => {
	t.tearDown(() => neo4j.end());

	// purge the database before each test
	t.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	var USERNAME = 'testuser';
	var DISPLAYNAME = 'Joe User 😊';
	var PASSWORD = 'password';
	var EMAIL = 'joe@example.com';

	t.test('get info for a user', (t) =>
		User.createWithPassword(USERNAME, PASSWORD, { displayname: DISPLAYNAME, email: EMAIL })
			.then(() => agent
				.get('/user/' + USERNAME)
				.then((res) => {
					t.equal(res.status, 200, 'http created');
					t.equal(res.body.user.username, USERNAME, 'username matches');
					t.equal(res.body.user.displayname, DISPLAYNAME, 'displayname matches');
					t.equal(res.body.user.email, EMAIL, 'email was correct');
					t.equal(res.body.user.deleted, false, 'not deleted');
					t.dateNear(res.body.user.create_time, new Date(), 5, 'create time is current');
					return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
				})
			)
	);

	t.test('get info for a user created with no email or display name', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/user/' + USERNAME)
				.then((res) => {
					t.equal(res.status, 200, 'http created');
					t.equal(res.body.user.username, USERNAME, 'username matches');
					t.equal(res.body.user.displayname, USERNAME, 'displayname matches');
					t.equal(res.body.user.email, false, 'email was correct');
					t.equal(res.body.user.deleted, false, 'not deleted');
					t.dateNear(res.body.user.create_time, new Date(), 5, 'create time is current');
					return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
				})
			)
	);

	t.test('404s when a user does not exist', (t) =>
		agent.get('/user/nobody')
			.then((res) => {
				t.equal(res.status, 404, 'http not found');
				return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
			})
	);

	t.test('404s when a user has been deleted', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => User.delete(USERNAME))
			.then((deletedUser) => Promise.join(
				agent.get('/user/' + USERNAME)
					.then((res) => {
						t.equal(res.status, 404, 'http not found');
						return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
					}),
				agent.get('/user/' + deletedUser.username)
					.then((res) => {
						t.equal(res.status, 404, 'http not found');
						return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
					}),
				() => null
			))
	);

	t.end();
});
