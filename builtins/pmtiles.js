const load = require("../lib/load");
const pmtiles = load("pmtiles");

// map pmtiles compression id to method
const pmcompression = [ null, null, "gz", "br", "zstd" ];

const cache = {};

// pmtiles backend
module.exports = function({ req, res, opts, data }, next){
	const mime = this.lib.mime;
	const debug = this.lib.debug;
	const decompress = this.lib.decompress;

	if (!pmtiles) return next(new Error("Dependency 'pmtiles' is missing."));

	const run = function(){
		const pm = cache[data.map];

		debug.info("Fetching %s/%s/%s", data.req.params.z, data.req.params.x, data.req.params.y);
		pm.tiles.getZxy(data.req.params.z, data.req.params.x, data.req.params.y).then(function(result){

			// undefined result means tile does not exists
			if (!result) return next(new Error("PMTiles: tile does not exist"));

			// pm.tiles.decompress(Buffer.from(result.data), pm.header.tileCompression).then(function(buf){
			// pmtiles spec allows gzip, brotli and zstd, decompress function only supports gzip. use own implementation?
			decompress(Buffer.from(result.data), pmcompression[pm.header.tileCompression]).then(function(buf){

				const tile = {
					buffer: buf,
					type: pm.type,
					status: ((buf.length > 0) ? 200 : 204),
					mimetype: mime.mimetype([pm.type]),
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

			}).catch(function(err){
				return next(err);
			});

		}).catch(function(err){
			return next(err);
		});

	};

	if (cache.hasOwnProperty(data.map)) return run();

	cache[data.map] = {};
	cache[data.map].tiles = new pmtiles.PMTiles(opts.url);

	cache[data.map].tiles.getHeader().then(function(header){

		cache[data.map].header = header;

		switch (header.tileType) {
			case 0: cache[data.map].type = "bin"; break;
			case 1: cache[data.map].type = "pbf"; break;
			case 2: cache[data.map].type = "png"; break;
			case 3: cache[data.map].type = "jpeg"; break;
			case 4: cache[data.map].type = "webp"; break;
		};

		run();

	});

};
