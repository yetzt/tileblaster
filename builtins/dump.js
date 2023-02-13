const util = require("util");

// a debuging module: dump all the information and end the request
module.exports = function({ res, data }, next){
	const dump = util.inspect(data, false, 3);

	console.error(dump);

	// do nothing if response stream has been uses
	if (res.used || res.headersSent || !res.writable || res.destroyed || res.finished || res.closed || res.piped) return;

	res.statusCode = 200;
	res.setHeader("content-type", "text/plain");
	res.end(dump);

};
