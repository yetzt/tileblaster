const load = require("../lib/load");
const vtt = load("vtt");

const cache = {};

// versatiles backend
module.exports = function({ req, res, opts, data }, next){
	const debug = this.lib.debug;

	if (!vtt) return next(new Error("Dependency 'vtt' is missing."));

	if (!opts.edit || typeof opts.edit !== "function") {
		debug.warn("No edit function specified, skipping");
		return next();
	}

	// apply to all tiles
	data.tiles.filter(function(tile){
		return tile.type === "pbf";
	}).forEach(function(tile){
		try {
			tile.buffer = Buffer.from(vtt.pack(opts.edit(vtt.unpack(tile.buffer))));
		} catch (err) {
			debug.error("Editing vector tile failed:", err);
		}
	});

	next();

};
