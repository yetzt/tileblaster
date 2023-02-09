const stream = require("node:stream");

// deliver tile
module.exports = function({ res, opts, data }, next){

	// do nothing if response stream has been uses
	if (!res.writable || res.destroyed || res.finished || res.closed || res.piped) return next();

	// find best tile FIXME → extra builtin

	// if tile buffer is empty, return 204
	if (data.tile.buffer.length === 0) {
		res.statusCode = 204;
		res.end();
		return next();
	}

	// set status and content-type
	res.statusCode = 200;
	res.setHeader("content-type", data.tile.mimetype);

	// set headers
	Object.entries({
		...data.headers, // generic
		...data.tile.headers, // tile-specific
		...opts.headers, // from opts
	}).forEach(function([ k, v ]){
		res.setHeader(k, v);
	});

	// send as stream
	stream.Readable.from(data.tile.buffer).pipe(res);
	// res.end(data.tile.buffer);

	next();
};
