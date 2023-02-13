const fs = require("fs");
const dur = require("dur");
const path = require("path");
const xattr = require("fs-xattr");

const cache = { store: {}, get: {} };

// file cache
module.exports = function({ req, res, opts, data }, next){
	const debug = this.lib.debug;
	const strtpl = this.lib.strtpl;
	const config = this.config;

	// from cache or to?
	switch (opts.action) {
		case "retrieve":
		case "read":
		case "get":
			return next(); // TODO
		break;
		case "store":
		case "write":
		case "set":
		default:

			// store opts
			// true: expired instantly, false: expires never, number: seconds, string: parse
			if (!cache.store.hasOwnProperty(data.map)) cache.store[data.map] = {
				expires: (!opts.expires) ? false :
				(typeof opts.expires === "boolean") ? opts.expires :
				(typeof opts.expires === "number") ? ((Number.isFinite(opts.expires)) ? Math.max(0,Math.round(opts.expires*1000)) : (opts.expires > 0)) || true :
				(typeof opts.expires === "string") ? dur(opts.expires, true) : true,
			};
			opts = cache.store[data.map];

			// check if action is unnessecary
			if (opts.expires === true) {
				debug.warn("Cache: Skipping due to immediate expiration in map %s", data.map.magenta);
				return next();
			};

			// ensure unique tiles FIXME

			// all the unique tiles
			Promise.allSettled(
				data.tiles.map(function(tile){
					return new Promise(function(resolve, reject){

						// console.log(opts.expires);

						// set cache headers
						// TODO consult someone who understands all these better
						const expires = Date.now() * opts.expires;
						switch (opts.expires) {
							case false: // never
								tile.headers["cache-control"] = "min-age=86400"; // but come back in a while anyway
							break;
							case true: // instant
								tile.headers["expires"] = new Date(Date.now()).toUTCString();
								tile.headers["cache-control"] = "no-cache, max-age=0, must-revalidate";
							break;
							default: // set duration
								tile.headers["expires"] = new Date(Date.now()+opts.expires).toUTCString();
								tile.headers["cache-control"] = "public, max-age="+Math.round(opts.expires/1000)+", must-revalidate";
							break;
						};

						// find dest
						tile.dest = strtpl(data.dest, tile.params);
						let destfile = path.resolve(config.paths.data, path.isAbsolute(tile.dest) ? tile.dest.slice(1) : tile.dest);

						// see if tile exists, check if replacement needed,
						fs.stat(destfile, function(err, stats){

							// check if cached tile is still good
							// FIXME so this before setting headers?
							if (!err && !opts.expires) {
								debug.info("Cache: Saved tile %s valid forever", path.relative(config.paths.data, destfile).magenta);
								return resolve();
							}

							if (!err && stats.mtimeMs+opts.expires > Date.now()) {
								debug.info("Cache: Saved tile %s still valid", path.relative(config.paths.data, destfile).magenta);
								tile.headers["expires"] = new Date(stats.mtimeMs+opts.expires).toUTCString();
								return resolve();
							}

							// console.log(tile.headers);
							let tmpfile = destfile+".tmp";

							// create bas path
							fs.mkdir(path.dirname(tmpfile), { recursive: true }, function(err){
								if (err) {
									debug.error("Cache: create path %s to disk: %s", path.relative(config.paths.data, path.dirname(tmpfile)).magenta, err);
									return reject();
								};

								fs.writeFile(tmpfile, tile.buffer, function(err){
									if (err) {
										debug.error("Cache: write %s to disk: %s", path.relative(config.paths.data, tmpfile).magenta, err);
										fs.unlink(tmpfile, function(){}); // attempt unlinking
										return reject();
									}

									// write xattr
									// they should include anything we need for serving an cache cleaning
									xattr.set(tmpfile, "user.tileblaster", JSON.stringify({
										expires: (typeof opts.expires === "boolean") ? opts.expires : Date.now()+opts.expires,
										status: tile.status,
										headers: tile.headers,
									})).then(function(err){
										if (err) {
											debug.error("Cache: xattr for %s: %s", path.relative(config.paths.data, tmpfile).magenta, err);
											fs.unlink(tmpfile, function(){}); // attempt unlinking
											return reject();
										}

										// switch tmp → file
										fs.rename(tmpfile, destfile, function(err){
											if (err) {
												debug.error("Cache: move %s → %s: %s", path.relative(config.paths.data, tmpfile).magenta, path.relative(config.paths.data, destfile).magenta, err);
												fs.unlink(tmpfile, function(){}); // attempt unlinking
												return reject();
											}

											debug.info("Cache: saved %s", path.relative(config.paths.data, destfile).magenta);
											resolve();

										});

									});

								});

							});

						});

					});
				})
			).then(function(){
				next();
			});

		break;
	}

};
