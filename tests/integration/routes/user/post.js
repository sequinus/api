process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

var test    = require('tap').test;
var neo4j   = require('../../../../io/neo4j');
var app     = require('../../../../index');
var agent   = require('supertest-as-promised').agent(app);
var joi     = require('joi');
var schemas = require('../../../../schemas');

require('tapdate')();

var DATE_TOLERANCE = 5;
var ERROR_RESPONSE_SCHEMA = schemas.response.validationError;
var VALID_RESPONSE_SCHEMA = joi.object().keys({
	user: schemas.model.user.required(),
	token: schemas.jwtToken.required(),
});

test('POST /user', (t) => {
	t.tearDown(() => neo4j.end());

	// purge the database before each test
	t.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	var USERNAME = 'testuser';
	var DISPLAYNAME = 'Joe User 😊';
	var PASSWORD = 'password';

	t.test('create a user with a password', (t) =>
		agent.post('/user')
			.send({
				username: USERNAME,
				displayname: DISPLAYNAME,
				password: PASSWORD,
			})
			.then((res) => {
				t.equal(res.status, 201, 'http created');
				t.equal(res.body.user.username, USERNAME, 'username matches');
				t.equal(res.body.user.displayname, DISPLAYNAME, 'displayname matches');
				t.equal(res.body.user.email, false, 'email was null');
				t.equal(res.body.user.deleted, false, 'not deleted');
				t.dateNear(res.body.user.create_time, new Date(), DATE_TOLERANCE, 'create time is current');
				return schemas.validate(res.body, VALID_RESPONSE_SCHEMA);
			})
	);

	t.test('rejects a malformed request', (t) =>
		agent.post('/user')
			.send({
				username: '',
				password: '',
			})
			.then((res) => {
				t.equal(res.status, 400, 'http bad request');
				return schemas.validate(res.body, ERROR_RESPONSE_SCHEMA);
			})
	);

	t.end();
});
