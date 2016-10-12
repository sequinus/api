
var isArray = Array.isArray;
var flatten = require('lodash/flattenDeep');

function buildNode (name, type, valueId) {
	var str = name;
	if (type) str += ':' + type;
	if (valueId) {
		str += ' ' + valueId;
	}
	return str;
}

module.exports = exports = function () {
	var data = {};
	var statements = [];
	var lastStatement;
	var lastId = 0;

	function bindData (values) {
		if (!values) return null;
		var id = 'VALUE' + (++lastId);
		data[id] = values;
		return '{ ' + id + ' }';
	}

	function buildRelation (direction, left, right, relationName, relationValueId) {
		var leftArrow = '-';
		var rightArrow = '->';
		if (direction === 'left') {
			leftArrow = '<-';
			rightArrow = '-';
		}
		if (direction === 'both') {
			leftArrow = '-';
			rightArrow = '-';
		}

		if (isArray(left))   left = buildNode( left[0],  left[1], bindData( left[2]));
		if (isArray(right)) right = buildNode(right[0], right[1], bindData(right[2]));

		var str = `(${left || ''})${leftArrow}[`;
		if (typeof relationName === 'object') {
			var k = Object.keys(relationName)[0];
			str += k + ':' + relationName[k];
		} else {
			str += ':' + relationName;
		}
		if (relationValueId) {
			str += ' ' + relationValueId;
		}
		str += `]${rightArrow}(${right || ''})`;

		return str;
	}

	function processWhereCondition (field, value, operator) {
		if (!operator) operator = '=';

		if (isArray(field)) {
			return field.map((f) => processWhereCondition(f, value, operator));
		}

		// if value is an array, then we need to compare against multiple values
		if (isArray(value)) {
			// if the operator is a plain equals, we should perform an IN() instead of multiple ORs
			if (operator === '=') {
				// process the values into bindings, and join the bindings inside an IN() clause
				return field + ' IN ' + bindData(value);
			} else if (operator === '!=') {
				// process the values into bindings, and join the bindings inside an IN() clause
				return field + ' NOT IN ' + bindData(value);
			}

			// process each value individually as a single condition and join the values in an OR
			return value.map((v) => processWhereCondition(field, v, operator));
		}

		return [ field, operator, bindData(value) ].join(' ');
	};

	function processWhereObject (clause, operator) {
		if (!operator) operator = '=';

		clause = Object.keys(clause).map((field) => {
			// if the object contains a 'not' key, all subsequent keys parsed will be negations.
			if (field === 'not' && clause[field] === true) {
				if (operator === '=') operator = '!=';
				return undefined;
			}

			return processWhereCondition(field, clause[field], operator);
		});

		clause = flatten(clause).filter(Boolean);

		if (clause.length === 1) {
			return clause[0];
		} else if (clause.length > 1) {
			return '(' + clause.join(' AND ') + ')';
		}

		return undefined;
	};


	var maker = {
		bindData,

		create () {
			lastStatement = {
				type: 'create',
				nodeCount: 0,
				segments: [ 'CREATE' ],
			};
			statements.push(lastStatement);
			return maker;
		},

		match () {
			lastStatement = {
				type: 'match',
				nodeCount: 0,
				segments: [ 'MATCH' ],
			};
			statements.push(lastStatement);
			return maker;
		},

		merge () {
			lastStatement = {
				type: 'merge',
				nodeCount: 0,
				segments: [ 'MERGE' ],
			};
			statements.push(lastStatement);
			return maker;
		},

		node (name, type, values) {
			lastStatement.nodeCount++;
			if (lastStatement.nodeCount > 1) lastStatement.segments.push(',');
			lastStatement.segments.push('(' + buildNode(name, type, bindData(values)) + ')');
			return maker;
		},

		relation (nameLeft) {
			lastStatement.nodeCount++;
			if (lastStatement.nodeCount > 1) lastStatement.segments.push(',');

			return {
				to (nameRight, relName, values) {
					lastStatement.segments.push(buildRelation('right', nameLeft, nameRight, relName, bindData(values)));
					return maker;
				},

				from (nameRight, relName, values) {
					lastStatement.segments.push(buildRelation('left', nameLeft, nameRight, relName, bindData(values)));
					return maker;
				},
			};
		},

		connect (nameLeft, relName, nameRight, values, direction) {
			if (!direction && lastStatement.type === 'match') {
				direction = 'both';
			}
			lastStatement.segments.push(buildRelation(direction, nameLeft, nameRight, relName, bindData(values)));
			return maker;
		},

		connectRight (nameLeft, relName, nameRight, values) {
			lastStatement.segments.push(buildRelation('right', nameLeft, nameRight, relName, bindData(values)));
			return maker;
		},

		connectLeft (nameLeft, relName, nameRight, values) {
			lastStatement.segments.push(buildRelation('left', nameLeft, nameRight, relName, bindData(values)));
			return maker;
		},

		where (clause, value, operator) {
			if (lastStatement.type !== 'where') {
				lastStatement = {
					type: 'where',
					clauses: [],
					segments: [ 'WHERE' ],
				};
				statements.push(lastStatement);
			}

			// if a value is defined, then we're performing a field > value comparison
			// and must parse that first.
			if (value !== undefined && (typeof clause === 'string' || isArray(clause))) {
				clause = processWhereCondition(clause, value, operator);

			// if there was no value, check to see if we got an object based where definition
			} else if (typeof clause === 'object' && !isArray(clause)) {
				operator = value;
				clause = processWhereObject(clause, operator);
			}

			// if we've got an array at this point, then we should parse it as if it were
			// a collection of possible conditions in an OR
			if (isArray(clause)) {
				clause = flatten(clause).map((c) => {
					switch (typeof c) {
					case 'string': return c;
					case 'object': return processWhereObject(c, operator);
					default:
						throw new TypeError('Where clause could not be processed. Found ' + (typeof c) + ' instead.');
					}
				});

				var l = clause.length;
				var subBoolean = ' OR ';
				if (l === 1) {
					clause = clause[0];
				} else if (l > 1) {
					// if the first value in the array is "AND", reverse our typical boolean.
					if (clause[0] === 'AND') {
						subBoolean = ' AND ';
						clause.shift();
						l--;
					}
					if (l === 1) {
						clause = clause[0];
					} else {
						clause = '(' + clause.join(subBoolean) + ')';
					}
				} else {
					clause = null;
				}
			}

			// by now the clause should be a string. if it isn't, then someone gave us an unusable clause
			if (typeof clause === 'string') {
				lastStatement.clauses.push(clause);
			} else {
				throw new TypeError('Where clause could not be processed. Found ' + (typeof clause) + ' instead.');
			}

			lastStatement.segments = [ 'WHERE', lastStatement.clauses.join(' AND ') ];

			return maker;
		},

		return (r) {
			lastStatement = {
				type: 'return',
				segments: [ 'RETURN', r ],
			};
			statements.push(lastStatement);
			return maker;
		},

		skip (count) {
			lastStatement = {
				type: 'skip',
				segments: [ 'SKIP', Number(count) ],
			};
			statements.push(lastStatement);
			return maker;
		},

		limit (count) {
			lastStatement = {
				type: 'limit',
				segments: [ 'LIMIT', Number(count) ],
			};
			statements.push(lastStatement);
			return maker;
		},

		orderBy (str) {
			lastStatement = {
				type: 'orderby',
				segments: [ 'ORDER BY', str ],
			};
			statements.push(lastStatement);
			return maker;
		},

		compile () {
			var str = statements.map((statement) => statement.segments.join(' ')).join('\n');
			return [ str, data ];
		},
	};

	return maker;
};
