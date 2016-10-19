
var logger  = require('./log');
var express = require('express');
var boom    = require('boom');

var app = module.exports = exports = express();

app.get('/favicon.ico', (req, res) => res.status(404).send()); // ignore favicons

app.use(logger.middleware());
app.use(require('body-parser').json());

app.use(require('./routes'));

// 404 handler
app.use((req, res, next) => next(boom.notFound('The requested path does not exist')));

// setup error handling
app.use(require('./middleware/error-handler'));
