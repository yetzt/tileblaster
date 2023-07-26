const zlib = require("node:zlib");
const promisify = require("node:util").promisify;

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const cache = {};

// compress tiles
module.exports = function({ req, res, opts, data }, next){
	const debug = this.lib.debug;

	if (!cache.hasOwnProperty(data.map)) cache[data.map] = {
		brotli: (!opts.brotli) ? false :
			(opts.brotli === true) ? { level: 9 } : // reasonable
			(typeof opts.brotli === "number") ? { level: opts.brotli } :
			(typeof opts.brotli === "object") ? opts.brotli : {},
		gzip: (!opts.gzip) ? false :
			(opts.gzip === true) ? { level: 9 } : // reasonable
			(typeof opts.gzip === "number") ? { level: opts.gzip } :
			(typeof opts.gzip === "object") ? opts.gzip : {},
	};
	opts = cache[data.map];

	// pass through if nothing to do, but complain
	if (!opts.brotli && !opts.gzip) {
		debug.warn("No compression enabled for map '%s'", data.map);
		return next();
	};

	// ensure unique tiles FIXME

	// compress all uncompressed tiles
	Promise.allSettled(data.tiles.filter(function(tile){
		return (!tile.compression && tile.buffer.length > 0) // filter already compressed or  empty tiles
	}).reduce(function(promises, tile){

		// FIXME: roll this up:
		if (opts.brotli) promises.push(new Promise(function(resolve, reject) {
			brotli(tile.buffer, opts.brotli).then(function(compressed){
				if (compressed.length > tile.buffer.length) {
					debug.warn("Discarding useless Brotli compression for %s: +%db", data.path.magenta, compressed.length-tile.buffer.length);
					return resolve();
				};
				data.tiles.push({
					...tile,
					buffer: compressed,
					compression: "br",
					headers: { ...(tile.headers||{}), "content-encoding": "br" },
					params: { ...(tile.params||{}), c: ".br" },
				});
				resolve();
			}).catch(function(err){
				debug.error("Brotli failed for %s: %s", data.path.magenta, err);
				reject(err);
			});
		}));

		if (opts.gzip) promises.push(new Promise(function(resolve, reject) {
			gzip(tile.buffer, opts.gzip).then(function(compressed){
				if (compressed.length > tile.buffer.length) {
					debug.warn("Discarding useless Gzip compression for %s: +%db", data.path.magenta, compressed.length-tile.buffer.length);
					return resolve();
				}
				data.tiles.push({
					...tile,
					buffer: compressed,
					compression: "gzip",
					headers: { ...(tile.headers||{}), "content-encoding": "gzip" },
					params: { ...(tile.params||{}), c: ".gz" },
				});
				resolve();
			}).catch(function(err){
				debug.error("Gzip failed for %s: %s", data.path.magenta, err);
				reject(err);
			});
		}));

		return promises;
	}, [])).then(function(){

		// set tile to best compressed tile client accepts FIXME find by buffer size?
		const bestCompression = (opts.brotli && data.req.supports.br) ? "br" : (opts.gzip && data.req.supports.gz) ? "gzip" : null;
		if (bestCompression) data.tile = data.tiles.find(function(tile){
			return tile.compression === bestCompression && tile.mimetype === data.tile.mimetype && tile.filetype === data.tile.filetype;
		}) || data.tile;

		next();
	});

};
