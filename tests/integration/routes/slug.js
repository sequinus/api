process.env.BLUEBIRD_DEBUG = true;
process.env.BLUEBIRD_LONG_STACK_TRACES = true;

// var Promise   = require('bluebird');
var suite     = require('tapsuite');
var bootstrap = require('../../bootstrap');
var neo4j     = require('../../../io/neo4j');
var agent     = bootstrap.agent;

suite('GET /message', (s) => {

	s.after(() => neo4j.end());

	s.test('get a message by slug redirects with all query params', (t) => bootstrap({ depth: 1 }).then((conditions) => {
		var message = conditions.topics[0];
		return agent
			.get(`/slug/${message.slug}`)
			.query({
				depth: 2,
				context: 1,
			})
			.expect(302)
			.expect('Location', `/message/${message.id}?depth=2&context=1`)
			.then(() => {
				t.pass('Received redirect to correct path');
			});
	}));


});
