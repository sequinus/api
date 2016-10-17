
var cloneDeep = require('lodash/cloneDeep');

module.exports = exports = (req) => ({
	href: req.href,
	protocol: req.protocol,
	hostname: req.hostname,
	port: req.port,
	pathname: req.path,
	query: cloneDeep(req.query),
});
