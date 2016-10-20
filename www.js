#!/usr/bin/env node

var config    = require('./config');

if (!config.isProd) {
	process.env.BLUEBIRD_DEBUG = true;
	process.env.BLUEBIRD_LONG_STACK_TRACES = true;
}

if (config.newrelic || process.env.NEW_RELIC_LICENSE_KEY) {
	process.env.NEW_RELIC_LICENSE_KEY    = process.env.NEW_RELIC_LICENSE_KEY    || config.newrelic.license;
	process.env.NEW_RELIC_APP_NAME       = process.env.NEW_RELIC_APP_NAME       || config.newrelic.appName;
	process.env.NEW_RELIC_LOG_LEVEL      = process.env.NEW_RELIC_LOG_LEVEL      || 'info';
	process.env.NEW_RELIC_NO_CONFIG_FILE = process.env.NEW_RELIC_NO_CONFIG_FILE || true;
	process.env.NEW_RELIC_LOG            = process.env.NEW_RELIC_LOG            || 'stdout';
} else {
	process.env.NEW_RELIC_ENABLED = 'false';
}

require('newrelic');

var log     = require('./log')('www');
var app     = require('./index');

var http      = require('http');
var Promise   = require('bluebird');

log.info(`Current environment is "${config.envName}"`);

if (config.isProd) {
	log.info(config, 'Current configuration');
}

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
