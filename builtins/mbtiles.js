const load = require("../lib/load");
const versatiles = load("mbg");

const cache = {};

// versatiles backend
module.exports = function({ req, res, opts, data }, next){
	const mime = this.lib.mime;
	const debug = this.lib.debug;
	const decompress = this.lib.decompress;

	if (!mbg) return next(new Error("Dependency 'mbg' is missing."));

	// cache mbg instance
	if (!cache.hasOwnProperty(data.map)) cache[data.map] = new mbg(opts.file);
	const mb = cache[data.map];

	debug.info("Fetching %s/%s/%s", data.req.params.z, data.req.params.x, data.req.params.y);
	mb.get(data.req.params.z, data.req.params.x, data.req.params.y, function(err, buf, info){
		if (err) return next(err);

		// decompress tile
		decompress(buf, info.compression, function(err, buf){
			if (err) return next(err);

			const tile = {
				buffer: buf,
				type: mime.filetype(info.mimetype),
				status: ((buf.length > 0) ? 200 : 204),
				mimetype: info.mimetype,
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
