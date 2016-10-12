
var Promise = require('bluebird');
var config = require('../config').io.neo4j;
var neo4j = require('neo4j-driver').v1;
var set = require('lodash/set');
var log = require('../log')('neo4j');

var driver;

function convertResults (results) {
	log.trace(results.records, 'Original results');
	return results.records.map((record) => {
		var data = {};
		record.forEach((v, k) => {
			set(data, k, v);
		});
		return data;
	});
}

function convertError (oErr) {
	// console.log('CONVERT', oErr);
	log.trace(oErr, 'Original error');
	if (oErr instanceof Error) return Promise.reject(oErr);
	if (oErr.fields && oErr.fields[0]) {
		var error = oErr.fields[0];
		var err = new Error(error.message);
		err.code = error.code;
		err.originalErr = oErr;
		return Promise.reject(err);
	}
	return Promise.reject(oErr);
}

module.exports = exports = {
	session () {
		if (!driver) {
			driver = neo4j.driver(`bolt://${config.host}:${config.port}`, neo4j.auth.basic(config.user, config.pass));
			log.debug('Driver Initialized', `bolt://${config.host}:${config.port}`);
		}
		return driver.session();
	},

	run (statement, params) {
		var time = Date.now();
		var session = this.session();
		var pResults = Promise.resolve(session.run(statement, params).catch(convertError))
			.finally(() => Promise.fromCallback((cb) => session.close(cb)));

		pResults.then(
			() => log.debug({
				query: '\n' + statement,
				data: params,
				duration: (Date.now() - time) + 'ms',
			}, 'Query Executed'),

			(err) => {
				log.error({
					err,
					query: '\n' + statement,
					data: params,
					duration: (Date.now() - time) + 'ms',
				}, 'Query Failed');
			}
		);

		return pResults.then(convertResults);
	},

	transaction () {
		var session = this.session();
		var trans = session.beginTransaction();
		log.debug('Transaction Started');

		function close (result) {
			trans = null;
			return Promise.fromCallback((cb) => session.close(cb))
				.then(() => {
					session = null;
					return result;
				});
		}

		return {
			run (statement, params) {
				if (!trans) return Promise.reject(new Error('Transaction has closed.'));
				var time = Date.now();
				var pResults = Promise.resolve(trans.run(statement, params).catch(convertError));

				pResults.then(
					() => log.debug({
						query: '\n' + statement,
						data: params,
						duration: (Date.now() - time) + 'ms',
						transaction: true,
					}, 'Query Executed'),

					(err) => {
						log.error({
							err,
							query: '\n' + statement,
							data: params,
							duration: (Date.now() - time) + 'ms',
							transaction: true,
						}, 'Query Failed');
					}
				);

				return pResults.then(convertResults);
			},

			commit () {
				return Promise.resolve(trans.commit().catch(convertError))
					.then(close, (err) => Promise.reject(close(err)))
					.then((result) => {
						log.debug('Transaction Committed');
						return result;
					});
			},

			rollback () {
				return Promise.resolve(trans.rollback().catch(convertError))
					.then(close, (err) => Promise.reject(close(err)))
					.then((result) => {
						log.error('Transaction Rolled back');
						session = trans = null;
						return result;
					});
			},
		};
	},

	end () {
		return driver && driver.close();
	},
};

process.on('graceful stop', (waiting) => waiting.push(exports.end()));
