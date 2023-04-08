
// sharp image manipulation
module.exports = function sharp({ opts, data }, next){
	const sharp = this.lib.sharp;
	const debug = this.lib.debug;

	// check if sharp is available
	if (typeof sharp === "undefined") {
		debug.warn("sharp: `sharp` dependency is missing.");
		return next();
	};

	// check if image can be edited
	if (!["png","jpeg","jpg","gif","webp","avif","tif","tiff"].includes(data.tile.type)) {
		debug.warn("sharp: Unsupported file type: %s", data.tile.type);
		return next();
	};

	let img = sharp(data.tile.buffer);
	let error = null;

	Object.entries(opts).filter(function([method, param]){
		return (typeof img[method] === "function");
	}).forEach(function([method, param]){
		if (error) return;
		try {
			img = img[method](param);
		} catch (err) {
			debug.error("sharp: %s failed", method, err);
			img = null, error = err;
		}
	});

	// end on previous error
	if (error) return next(error);

	// write buffer to tile
	img.toBuffer().then(function(buf){
		data.tile.buffer = buf;
		next();
	}).catch(function(err){
		debug.error("sharp: creating image buffer failed", err);
		return next(err);
	});

};
