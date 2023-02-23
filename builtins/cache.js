const fs = require("fs");
const dur = require("dur");
const path = require("path");
const xattr = require("fs-xattr");

const cache = {};

// file cache
module.exports = function({ opts, data, res }, next, skip){
	const debug = this.lib.debug;
	const config = this.config;

	// cache opts
	if (!cache.hasOwnProperty(data.map)) {

		// store instance
		cache.store = this.lib.store({ root: config.paths.data });

		// merge opts of all uses of the cache builtin in a map config
		opts = config.maps[data.map].filter(function(use){
			return use.builtin === "cache";
		}).reduce(function(opts, useopts){
			return Object.entries(useopts).reduce(function(opts, [k,v]){
				return opts[k]=v,opts;
			}, opts);
		},{});

		cache[data.map] = {};

		// skipto
		cache[data.map].skipto = opts.skipto || false; // FIXME check valid label?

		// true: expires instantly, false: expires never, number: seconds, string: parse
		if (opts.hasOwnProperty("expires")) {
			switch (typeof opts.expires) {
				case "boolean":
					cache[data.map].expires = opts.expires;
				break;
				case "number":
					cache[data.map].expires = ((Number.isFinite(opts.expires)) ? Math.max(0,Math.round(opts.expires*1000)) : (opts.expires > 0)) || true;
				break;
				case "string":
					cache[data.map].expires = dur(opts.expires, true);
				break;
				default:
					cache[data.map].expires = true; // expires immediately
				break;
			}
		} else {
			cache[data.map].expires = false;
		}

	};
	opts = cache[data.map];
	const store = cache.store;

	// if tile length is empty, retrieve. otherwise save
	if (data.tiles.length === 0) {

		// find extensions
		let extensions = Object.entries(data.req.supports).reduce(function(extensions, [ext, supports]){
			if (supports) extensions.push(ext);
			return extensions;
		},[]);

		// get from storage
		return store.find(data.req.path, extensions, function(err, tile){
			if (err) return debug.error("Cache: Could not find %s: %s", data.req.path, err), next();
			if (!tile) return next();

			// check etag
			if (data.req.etag && tile.attr.headers && data.req.etag === tile.attr.headers.etag) {
				res.statusCode = 304;
				res.end();
				res.used = true;
				return skip(); // skip rest of jobs
			};

			// check last-modified
			if (data.req.last && tile.stats && data.req.last < tile.stats.mtimeMs) {
				res.statusCode = 304;
				res.end();
				res.used = true;
				return skip(); // skip rest of jobs
			};

			// if skipto is set, build tile data from cache and skip
			if (opts.skipto) {

				data.tile = tile.attr;
				fs.readFile(tile.file, function(err, buf){
					if (err) return debug.error("Cache: Could not read %s: %s", tile.file, err), next();

					data.tile.buffer = buf;
					data.tiles.push(data.tile);

					skip(opts.skipto);
				});

			} else { // send tile to client

				// if tile buffer is empty, return 204
				if (tile.stats.size === 0) {
					res.statusCode = 204;
					res.used = true;
					res.end();
					return skip(); // skip rest of jobs
				}

				// set status and content-type
				res.statusCode = tile.attr.status;

				// set headers
				Object.entries({
					...tile.attr.headers, // tile-specific
					"content-type": tile.attr.mimetype,
					"content-length": tile.stats.size,
				}).forEach(function([ k, v ]){
					res.setHeader(k, v);
				});

				// send as stream
				fs.createReadStream(tile.file).pipe(res);
				res.used = true;

				skip();

			}

		});

	} else {

		// set expires on all tiles
		if (opts.expires !== false) {
			let expires = Date.now()+opts.expires;
			data.tile.expires = expires;
			data.tiles.forEach(function(tile){
				tile.expires = expires;
			});
		}

		// FIXME set etag, last-modified?

		// no need to wait for files to get stored
		next();

		// skip storing if tiles expire immediately
		if (opts.expires === true) return debug.warn("Cache: Skipping due to immediate expiration in map %s", data.map.magenta);

		// store all tiles if not stored
		Promise.allSettled(data.tiles.map(function(tile){


			return new Promise(function(reject, resolve){
				store.put(tile, function(err){
					if (err) return debug.warn("Cache: Error storing %s: %s", tile.path.magenta, err), reject(err);
					return debug.info("Cache: Stored %s", tile.path.magenta), resolve();
				});
			});
		}));

	}

};
