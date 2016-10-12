
var neo4j       = require('../io/neo4j');
var Password    = require('../lib/passwords');
var random      = require('../lib/random');
var stripIndent = require('common-tags/lib/stripIndent');
var get         = require('lodash/get');

exports.get = function (username) {
	var query = stripIndent`
		MATCH (u:User { username: {username}, deleted: false })
		RETURN u
	`;

	var data = { username };

	return neo4j.run(query, data)
		.then((results) => get(results, '[0].u.properties'));
};

exports.validatePassword = function (username, password) {
	var query = stripIndent`
		MATCH (u:User { username: {username}, deleted: false }), (u)-[:LOGIN_WITH]->(p:Password)
		RETURN u.username AS username, p.hash AS hash
	`;

	var data = { username };

	return neo4j.run(query, data)
		// confirm a user with that username returned and then pluck the hash
		.then((results) => results[0] && results[0].username === username && results[0].hash)

		// validate the hash against the given password (returns boolean)
		.then((hash) => hash && Password.check(password, hash));
};

exports.createWithPassword = function (username, password, options) {
	return Password.create(password).then((hash) => {

		var query = stripIndent`
			CREATE
				(u:User {user}),
				(p:Password { hash: {hash} }),
				(u)-[:LOGIN_WITH]->(p)
			RETURN u
		`;

		var data = {
			user: {
				username,
				displayname: options && options.displayname || username,
				email: options && options.email || false,
				deleted: false,
				create_time: (new Date()).toISOString(),
			},
			hash,
		};

		var transaction = neo4j.transaction();
		return transaction.run(query, data)
			.then((results) => transaction.commit().then(() => get(results, '[0].u.properties')));
	});
};

exports.changePassword = function (username, password) {
	return Password.create(password).then((hash) => {

		var query = stripIndent`
			MATCH (u:User { username: {username}, deleted: false })
			MERGE (u)-[:LOGIN_WITH]->(p:Password)
			ON CREATE SET p.hash = {hash}
			ON MATCH SET p.hash = {hash}
		`;

		var data = {
			username,
			hash,
		};

		var transaction = neo4j.transaction();

		return transaction.run(query, data)
			.then((result) => transaction.commit().then(() => result));
	});
};

exports.delete = function (username) {
	// set the User node to deleted and purge their logins
	var query = stripIndent`
		MATCH (u:User { username: {username} }),
			(u)-[:LOGIN_WITH]->(p:Password)
		SET u.deleted = {deleted}, u.username = {replacement}
		DETACH DELETE p
	`;

	var data = { username, replacement: username + '$' + random.alphanumeric(3), deleted: (new Date()).toISOString() };

	var transaction = neo4j.transaction();

	return transaction.run(query, data)
		.then((result) => transaction.commit().then(() => result));
};
