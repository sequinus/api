Sequinus API
===

This repo contains the application code for api.sequin.us.

## Setup

The dependencies for this application may be installed using `npm install` from the root directory, however it is recommended that you instead use the [`yarn`](http://npm.im/yarn) package manager, which will respect the lock file included in this repo.

By default the config for this app looks for a neo4j server running on localhost with the login `neo4j`/`test`. To override these values create a JSON file named`.sequinusapirc` in the root of the application (see the [`rc`](http://npm.im/rc) package for other possible locations) and replicate the structure in `config.js`.

## Launching

`npm start` or `yarn start` will launch the service and pipe the logging output through bunyan. By default the logging level is set to `debug` but can be reduced via the `LOG_LEVEL` environment variable.

If you wish to launch the app without bunyan parsing, execute it via:

```
node www.js
```

## Tests

This service relies largely on integration testing against an actual server for validating application behavior. These tests will use whatever server is configured for the application and **will destroy any data currently existing on the server**.  The test bootstrapping process removes all nodes and relationships before each test in order to ensure clean test conditions.

The full test suite can be execute via:

```
npm test
```

The test suite is written using the [`node-tap`](http://npm.im/tap) testing framework and individual test files can be executed directly as node scripts, for example:

```
node test/integration/routes/user/get.js
```

To run with code coverage:

```
npm run test:coverage
```

This project is not concerned with 100% code coverage but does expect to see main pathways being exercised.
