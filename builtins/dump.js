const util = require("node:util");

// a debuging module: dump all the information and end the request
module.exports = function({ res, data }, next, skip){
	const dump = util.inspect(data, false, 3);

	console.error(dump);

	// do nothing if response stream has been used
	if (res.used || res.headersSent || !res.writable || res.destroyed || res.finished || res.closed || res.piped) return;

	res.statusCode = 200;
	res.setHeader("content-type", "text/plain");
	res.end(dump);

	res.used = true;
	skip();

};
