const load = require("../lib/load");
const versatiles = load("vtt");

const cache = {};

// versatiles backend
module.exports = function({ req, res, opts, data }, next){
	const debug = this.lib.debug;

	if (!vtt) return next(new Error("Dependency 'mbg' is missing."));

	if (!opts.edit || typeof opts.edit !== "function") {
		debug.warn("No edit function specified, skipping");
		return next();
	}

	// apply to all tiles
	data.tiles.filter(function(tile){
		return tile.type === "pbf";
	}).forEach(function(tile){
		try {
			tile.buffer = vtt.pack(opts.edit(vtt.unpack(tile.buffer)));
		} catch (err) {
			debug.error("Editing vector tile failed:", err);
		}
	});

	next();

};
