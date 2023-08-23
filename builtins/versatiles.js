const load = require("../lib/load");
const versatiles = load("versatiles");

const cache = {};

// versatiles backend
module.exports = function({ req, res, opts, data }, next, skip){
	const mime = this.lib.mime;
	const debug = this.lib.debug;

	if (!versatiles) return next(new Error("Dependency 'versatiles' is missing."));

	// cache versatiles instance
	if (!cache.hasOwnProperty(data.map)) {
		cache[data.map] = new versatiles(opts.url, {
			tms: (!!opts.tms),
			headers: ((opts.hasOwnProperty("headers")) ? opts.headers : {}),
		});

		// skip function
		cache[data.map].abort = function(err){
			if (res.used) return;
			res.statusCode = 204; // no content
			res.setHeader("x-tileblaster-hint", err.message || err.toString());
			res.end();
			res.used = true; // mark connection as used
			return skip(); // skip rest of jobs
		};

	};
	const vt = cache[data.map];

	debug.info("Fetching %s/%s/%s", data.req.params.z, data.req.params.x, data.req.params.y);
	vt.getTile(data.req.params.z, data.req.params.x, data.req.params.y, function(err, buf){
		if (err) return cache[data.map].abort(err); // fail gracefully

		// if precompressed, keep in tile stack
		/* TODO evaluate side effects
		if (vt.header.tile_precompression) data.tiles.unshift({
			buffer: buf,
			type: vt.header.tile_format,
			status: ((buf.length > 0) ? 200 : 204),
			mimetype: vt.mimetypes[vt.header.tile_format],
			// defaults
			path: data.req.path,
			headers: {},
			compression: vt.header.tile_precompression,
			language: null,
			expires: true, // default policy
		}); */

		// decompress tile
		vt.decompress(vt.header.tile_precompression, buf, function(err, buf){
			if (err) return cache[data.map].abort(err); // fail gracefully

			const tile = {
				buffer: buf,
				type: vt.header.tile_format,
				status: ((buf.length > 0) ? 200 : 204),
				mimetype: vt.mimetypes[vt.header.tile_format],
				// defaults
				path: data.req.path,
				headers: {},
				compression: false,
				language: null,
				expires: true, // default policy
			};

			// add to tile stack, set primary tile
			data.tiles.unshift(tile);
			data.tile = tile;

			next();

		});

	});

};
