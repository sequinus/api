
var cypher = require('../../../lib/cypher');
var test = require('tap').test;
var stripIndent = require('common-tags/lib/stripIndent');

test('case 1', (t) => {
	var actual = cypher()
		.match().node('n')
		.where({ 'id(n)': [ 0, 1, 2 ] })
		.return('n.name')
		.compile();

	t.deepEqual(actual, [
		stripIndent`
			MATCH (n)
			WHERE id(n) IN { VALUE1 }
			RETURN n.name`,

		{
			VALUE1: [ 0, 1, 2 ],
		},
	]);

	t.end();
});

test('case 2', (t) => {
	var actual = cypher()
		.create().node('sally', 'Person', { name: 'Sally', age: 32 })
		.create().node('john', 'Person', { name: 'John', age: 27 })
		.create().node('gdb', 'Book', { title: 'Graph Databases', authors: [ 'Ian Robinson', 'Jim Webber' ] })
		.create().connect('sally', 'FRIEND_OF', 'john', { since: 1357718400 })
		.create().connect('sally', 'HAS_READ', 'gdb', { rating: 4, on: 1360396800 })
		.create().connect('john', 'HAS_READ', 'gdb', { rating: 5, on: 1359878400 })
		.compile();

	t.deepEqual(actual, [
		stripIndent`
			CREATE (sally:Person { VALUE1 })
			CREATE (john:Person { VALUE2 })
			CREATE (gdb:Book { VALUE3 })
			CREATE (sally)-[:FRIEND_OF { VALUE4 }]->(john)
			CREATE (sally)-[:HAS_READ { VALUE5 }]->(gdb)
			CREATE (john)-[:HAS_READ { VALUE6 }]->(gdb)`,

		{
			VALUE1: { name: 'Sally', age: 32 },
			VALUE2: { name: 'John', age: 27 },
			VALUE3: { title: 'Graph Databases', authors: [ 'Ian Robinson', 'Jim Webber' ] },
			VALUE4: { since: 1357718400 },
			VALUE5: { rating: 4, on: 1360396800 },
			VALUE6: { rating: 5, on: 1359878400 },
		},
	]);

	t.end();
});

test('case 3', (t) => {
	var actual = cypher()
		.match().node('sally', 'Person', { name: 'Sally' })
		.match().node('john', 'Person', { name: 'John' })
		.match().connect('sally', { r: 'FRIEND_OF' }, 'john')
		.return('r.since AS friends_since')
		.compile();

	t.deepEqual(actual, [
		stripIndent`
			MATCH (sally:Person { VALUE1 })
			MATCH (john:Person { VALUE2 })
			MATCH (sally)-[r:FRIEND_OF]-(john)
			RETURN r.since AS friends_since`,

		{
			VALUE1: { name: 'Sally' },
			VALUE2: { name: 'John' },
		},
	]);

	t.end();
});

test('case 4', (t) => {
	var actual = cypher()
		.match().node('gdb', 'Book', { title: 'Graph Databases' })
		.match().connect('gdb', { r: 'HAS_READ' }, null, null, 'left')
		.return('avg(r.rating) AS average_rating')
		.compile();

	t.deepEqual(actual, [
		stripIndent`
			MATCH (gdb:Book { VALUE1 })
			MATCH (gdb)<-[r:HAS_READ]-()
			RETURN avg(r.rating) AS average_rating`,

		{
			VALUE1: { title: 'Graph Databases' },
		},
	]);

	t.end();
});

test('case 5', (t) => {
	var actual = cypher()
		.match().node('people', 'Person')
		.where([
			{ 'people.name': 'John' },
			{ 'people.name': 'Sally' },
		])
		.match().connectRight('people', { r: 'HAS_READ' }, [ 'gdb', 'Book', { title: 'Graph Databases' } ])
		.return('people.name AS first_reader')
		.orderBy('r.on')
		.limit(1)
		.compile();

	t.deepEqual(actual, [
		stripIndent`
			MATCH (people:Person)
			WHERE (people.name = { VALUE1 } OR people.name = { VALUE2 })
			MATCH (people)-[r:HAS_READ]->(gdb:Book { VALUE3 })
			RETURN people.name AS first_reader
			ORDER BY r.on
			LIMIT 1`,

		{
			VALUE1: 'John',
			VALUE2: 'Sally',
			VALUE3: { title: 'Graph Databases' },
		},
	]);

	t.end();
});
