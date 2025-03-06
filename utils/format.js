const escape = (string) => {
	return string.toString()
		.replace(/\./g, '\\.')
		.replace(/!/g, '\\!')
		.replace(/-/g, '\\-')
		.replace(/_/g, '\\_')
		.replace(/\(/g, '\\(')
		.replace(/\)/g, '\\)')
		.replace(/\{/g, '\\{')
		.replace(/}/g, '\\}')
		.replace(/=/g, '\\=')
		.replace(/\|/g, '\\|')
		.replace(/\+/g, '\\+')
		.replace(/\[/g, '\\[')
		.replace(/]/g, '\\]');
};

module.exports = escape;