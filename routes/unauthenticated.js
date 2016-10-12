
var config    = require('../config');
var Promise   = require('bluebird');
var express   = require('express');
var joi       = require('joi');
var schemas   = require('../schemas');
var boom      = require('boom');
var basic     = require('basic-auth');
var makeToken = require('../lib/sign-jwt');

var router    = module.exports = exports = express.Router();

var User = require('../models/user');

router.get('/user/:username', (req, res, next) => {
	var username = req.params.username;

	var pUser = schemas.isValid(username, schemas.username) && User.get(username);

	Promise.resolve(pUser).then((user) => {
		if (!user) {
			throw boom.notFound(`User "${username}" does not exist.`);
		}

		res.json({
			user,
		});
	}).catch(next);
});

var userPostSchema = joi.object().keys({
	username: schemas.username.required(),
	password: schemas.password.required(),
	email: schemas.email,
});

router.post('/user', (req, res, next) => Promise.fromCallback((cb) => joi.validate(req.body, userPostSchema, { abortEarly: false }, cb)).then((body) => {

	var username = body.username;
	var password = body.password;
	var email = body.email;

	return User.get(username)
		.then((existing) => {
			if (existing) throw boom.conflict(`"${username}" is already in use.`);

			var pUser = User.createWithPassword(username, password, { email });
			var pToken = makeToken(username, config.jwt.defaultExpire);

			return Promise.join(pUser, pToken, (user, token) => {
				res.json({
					user,
					token,
				});
			});
		});

}).catch(next));

router.get('/authenticate', (req, res, next) => {
	var auth = basic(req);

	if (!auth || !auth.name || !auth.pass) {
		return next(boom.unauthorized('Did not receive a valid Basic Authorization header'));
	}

	var validUsername = schemas.isValid(auth.name, schemas.username);
	var pUser  = validUsername && User.get(auth.name);
	var pValid = validUsername && User.validatePassword(auth.name, auth.pass);
	var pToken = makeToken(auth.name, config.jwt.defaultExpire);

	Promise.join(pValid, pUser, pToken, (valid, user, token) => {
		if (!user) {
			throw boom.unauthorized(`User "${auth.name}" does not exist.`);
		}

		if (!valid) {
			throw boom.unauthorized('Authentication failed');
		}

		res.json({
			user,
			token,
		});
	}).catch(next);
});
