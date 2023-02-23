const stream = require("node:stream");

// deliver tile
module.exports = function({ res, opts, data }, next){

	// do nothing if response stream has been used
	if (res.used || res.headersSent || !res.writable || res.destroyed || res.finished || res.closed || res.piped) return next();

	// if tile buffer is empty, return 204
	if (data.tile.buffer.length === 0) {
		res.statusCode = 204;
		res.end();
		return next();
	}

	// set status and content-type
	res.statusCode = data.tile.status;

	// set headers
	Object.entries({
		...data.tile.headers, // tile-specific
		...opts.headers, // from opts
		"content-type": data.tile.mimetype,
		"content-length": data.tile.buffer.length,
	}).forEach(function([ k, v ]){
		res.setHeader(k, v);
	});

	// send as stream
	stream.Readable.from(data.tile.buffer).pipe(res);
	res.used = true;

	next();
};
