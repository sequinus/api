/* eslint consistent-this:0 */
'use strict';

var Promise = require('bluebird');
var tap = require('tap');
var Test = tap.Test;

module.exports = exports = function suite (name, extra, cb) {
	var args = Test.prototype._parseTestArgs(name, extra, cb);
	name = args[0];
	extra = args[1];
	cb = args[2];

	var tests = [];
	var only = null;
	var before = (done) => done();
	var after = (done) => done();
	var failure = () => null;

	return tap.test(name, extra, (tHarness) => {
		var harness = {
			test () {
				tests.push(Array.from(arguments));
			},

			skip (n, e, c) {
				var args = Test.prototype._parseTestArgs(n, e, c);
				n = args[0];
				e = args[1];
				c = args[2];

				e.skip = true;

				tests.push([ n, e, c ]);
			},

			todo (n, e, c) {
				var args = Test.prototype._parseTestArgs(n, e, c);
				n = args[0];
				e = args[1];
				c = args[2];

				e.skip = true;

				tests.push([ n, e, c ]);
			},

			only () {
				only = Array.from(arguments);
			},

			before (fn) {
				before = fn;
			},

			after (fn) {
				after = fn;
			},

			beforeEach: tHarness.beforeEach.bind(tHarness),
			afterEach:  tHarness.afterEach.bind(tHarness),

			onFailure (fn) {
				failure = fn;
			},
		};

		cb(harness);

		return fromCallbackOrPromise(before)
			.then(() => {
				if (only) return Promise.resolve(tHarness.test.apply(tHarness, only)).catch(failure);

				var pTests = tests.map((args) =>
					Promise.resolve(tHarness.test.apply(tHarness, args)).catch(failure)
				);

				return Promise.all(pTests);
			})
			.then(() => fromCallbackOrPromise(after));
	});
};

function fromCallbackOrPromise (fn) {
	if (typeof fn !== 'function') return Promise.resolve();
	return Promise.fromCallback((cb) => {
		var ret = fn(cb);
		if (ret && typeof ret.then === 'function') {
			Promise.resolve(ret).asCallback(cb);
		} else if (fn.length === 0) {
			// function doesn't support a callback and didn't
			// return a promise, so assume sync
			cb();
		}
	});
}
