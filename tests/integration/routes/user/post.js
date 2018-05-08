process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

require('tapdate')();
var suite     = require('tapsuite');
var neo4j   = require('../../../../io/neo4j');
var app     = require('../../../../index');
var agent   = require('supertest-as-promised').agent(app);
var schemas = require('../../../../schemas');
var route   = require('../../../../routes/user/post');

require('tapdate')();

var DATE_TOLERANCE = 5;

suite('POST /user', (s) => {
	s.after(() => neo4j.end());

	// purge the database before each test
	s.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	var USERNAME = 'testuser';
	var DISPLAYNAME = 'Joe User 😊';
	var PASSWORD = 'password';

	s.test('create a user with a password', (t) =>
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
				return schemas.validate(res.body, route.schema.responses[201]);
			})
	);

	s.test('rejects a malformed request', (t) =>
		agent.post('/user')
			.send({
				username: '',
				password: '',
			})
			.then((res) => {
				t.equal(res.status, 400, 'http bad request');
				return schemas.validate(res.body, schemas.response.validationError);
			})
	);

});
