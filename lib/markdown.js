
var config = require('../config');
var hljs   = require('highlight.js');
var md = require('markdown-it');
var milt = require('markdown-it-link-target');
var striptags = require('striptags');

function highlight (str, lang) {
	if (lang && hljs.getLanguage(lang)) {
		try {
			return hljs.highlight(lang, str).value;
		} catch (__) {}
	}

	return ''; // use external default escaping
}

var Markdown  = md(Object.assign({ highlight }, config.markdown))
	.use(milt, {
		target: '_blank',
	});

var MarkdownStrip  = md({ html: false, linkify: false });

module.exports = exports = (input) => Markdown.render(input);

exports.strip = (input) => striptags(MarkdownStrip.renderInline(input));
