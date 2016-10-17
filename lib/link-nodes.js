
var _ = require('lodash');
var _find = require('lodash/fp/find');

module.exports = exports = function (rows) {
	var nodes = {};
	var relationships = [];
	_.each(rows, (row) =>
		_.each(row, (cell, name) =>
			parseCell(name, cell)));

	function keyInt (int) {
		return int.low + ',' + int.high;
	}

	function parseCell (name, cell) {
		if (Array.isArray(cell)) return _.each(cell, (acell) => parseCell(name, acell));
		if (!cell) return;
		var id = keyInt(cell.identity);
		if (cell.constructor.name === 'Node' && !nodes[id]) {
			cell.name = name;
			nodes[id] = cell;
			cell.edgesTo = [];
			cell.edgesFrom = [];
		} else if (cell.constructor.name === 'Relationship') {
			relationships.push(cell);
		}
	}

	_.each(relationships, (rel) => {
		var start = rel.start && keyInt(rel.start);
		var startNode = start && nodes[start];

		var end = rel.end && keyInt(rel.end);
		var endNode = end && nodes[end];

		var find = _find((edge) => keyInt(edge.identity) === keyInt(rel.identity));

		var exists = (startNode && find(startNode.edgesTo)) || (endNode && find(endNode.edgesFrom));

		if (exists) return;

		rel.startNode = startNode;
		rel.endNode = endNode;

		if (startNode) {
			startNode.edgesTo.push(rel);
		}
		if (endNode) {
			endNode.edgesFrom.push(rel);
		}
	});
};
