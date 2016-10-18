
var schemas = require('../../schemas');
var test = require('tap').test;

test('joi.object.jsonMax', (t) => {

	t.test('rejects object too large', (t) => {
		var data = { someLongKey: 'Culpa dolore velit nostrud adipisicing eu laborum proident officia.' };
		var schema = schemas.joi.object().jsonMax(20);

		return schemas.validate(data, schema)
			.then(() => t.fail('Schema should have failed'))
			.catch((err) => {
				t.equal(err.message, '"value" cannot be larger than 20 bytes when JSON serialized', 'error message');
				t.deepEqual(err.details, [
					{
						message: '"value" cannot be larger than 20 bytes when JSON serialized',
						path: 'value',
						type: 'object.jsonMax',
						context: {
							value: '{"someLongKey":"Culpa dolore velit nostrud adipisi ...',
							totalSize: 85,
							maximum: 20,
							key: 'value',
						},
					},
				], 'error details');
			});
	});

	t.test('does not reject object within max', (t) => {
		var data = { someLongKey: 'Culpa dolore velit nostrud adipisicing eu laborum proident officia.' };
		var schema = schemas.joi.object().jsonMax(100);

		return schemas.validate(data, schema)
			.catch((err) => {
				t.fail('schema should not have failed');
				t.error(err);
			})
			.then((result) => {
				t.deepEqual(result, data);
			});
	});

	t.end();
});
