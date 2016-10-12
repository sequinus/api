#!/usr/bin/env node

var isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
	process.env.BLUEBIRD_DEBUG = true;
	process.env.BLUEBIRD_LONG_STACK_TRACES = true;
}

var config    = require('./config');

var log     = require('./log')('www');
var app     = require('./index');

var http      = require('http');
var Promise   = require('bluebird');

var server = http.createServer(app);
server.listen(config.port, config.host, () => {
	log.info(`Express server listening at http://${config.host}:${config.port}`);
});

var terminating = false;
var shutdown = function () {
	if (terminating) return;
	terminating = true;
	log.warn('Process is terminating, stopping server and finishing requests');
	server.close(function serverClosed () {
		log.info('Server halted');

		var promises = [];
		process.emit('graceful stop', promises);

		Promise.all(promises).finally(() => {
			log.warn('Shutdown');
			process.exit(0); // eslint-disable-line no-process-exit
		});
	});

	setTimeout(() => {
		log.error('Shutdown took too long, terminating.');
		process.exit(0); // eslint-disable-line no-process-exit
	}, 2000);
};

process.on('SIGUSR2', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.graceful = shutdown;
