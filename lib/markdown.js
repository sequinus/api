
var config = require('../config');
var hljs   = require('highlight.js');

function highlight (str, lang) {
	if (lang && hljs.getLanguage(lang)) {
		try {
			return hljs.highlight(lang, str).value;
		} catch (__) {}
	}

	return ''; // use external default escaping
}

var Markdown  = require('markdown-it')(Object.assign({ highlight }, config.markdown));

module.exports = exports = function (input) {
	return Markdown.render(input);
};
