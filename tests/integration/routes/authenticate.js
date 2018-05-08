process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

require('tapdate')();
var suite     = require('tapsuite');
var neo4j     = require('../../../io/neo4j');
var app       = require('../../../index');
var agent     = require('supertest-as-promised').agent(app);
var schemas   = require('../../../schemas');
var User      = require('../../../models/user');
var makeToken = require('../../../lib/sign-jwt');
var rootRoute = require('../../../routes/root');
var authRoute = require('../../../routes/authenticate');

require('tapdate')();

suite('GET /authenticate', (s) => {
	s.after(() => neo4j.end());

	// purge the database before each test
	s.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	var USERNAME = 'testuser';
	var PASSWORD = 'password';

	s.test('authenticate with basic auth and get a token', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/authenticate')
				.auth(USERNAME, PASSWORD)
				.then((res) => {
					t.equal(res.status, 200, 'http ok');
					t.equal(res.body.user.username, USERNAME, 'got back the right user info');
					var decoded = makeToken.decodeSync(res.body.token);
					t.equal(decoded.username, USERNAME, 'token has the right username');
					return schemas.validate(res.body, authRoute.schema.responses[200]);
				})
			)
	);

	s.test('authenticate fails with bad username', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/authenticate')
				.auth('nobody', PASSWORD)
				.then((res) => {
					t.equal(res.status, 401, 'http unauthorized');
					return schemas.validate(res.body, schemas.response.error);
				})
			)
	);

	s.test('authenticate fails with bad username', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/authenticate')
				.auth('nobody', PASSWORD)
				.then((res) => {
					t.equal(res.status, 401, 'http unauthorized');
					t.equal(res.body.errors[0].detail, 'User "nobody" does not exist.', 'correct error message');
					return schemas.validate(res.body, schemas.response.error);
				})
			)
	);

	s.test('authenticate fails with bad password', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/authenticate')
				.auth(USERNAME, 'invalid')
				.then((res) => {
					t.equal(res.status, 401, 'http unauthorized');
					t.equal(res.body.errors[0].detail, 'Authentication failed', 'correct error message');
					return schemas.validate(res.body, schemas.response.error);
				})
			)
	);

});

suite('GET /', (s) => {
	s.after(() => neo4j.end());

	// purge the database before each test
	s.beforeEach(() => neo4j.run('MATCH (n) DETACH DELETE (n)').then(() => null));

	var USERNAME = 'testuser';
	var PASSWORD = 'password';
	var TOKEN;

	s.before(() => makeToken(USERNAME).then((tok) => { TOKEN = tok; }));

	s.test('authenticate with bearer token', (t) =>
		User.createWithPassword(USERNAME, PASSWORD)
			.then(() => agent
				.get('/')
				.set('Authorization', `Bearer ${TOKEN}`)
				.then((res) => {
					t.equal(res.status, 200, 'http ok');
					t.equal(res.body.auth, USERNAME, 'shows user is logged in');
					return schemas.validate(res.body, rootRoute.schema.responses[200]);
				})
			)
		);

});
