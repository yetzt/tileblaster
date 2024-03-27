// convert
module.exports = function convert({ opts, data }, next){
	const sharp = this.lib.sharp;
	const debug = this.lib.debug;

	// check if sharp is available
	if (typeof sharp === "undefined") {
		debug.warn("Convert: Sharp dependency is missing.");
		return next();
	};

	// check if tile should be optimized
	if (!["png","jpeg","jpg","gif"].includes(data.tile.type)) {
		debug.warn("Convert: Unsupported file type: %s", data.tile.type);
		return next();
	};

	Promise.allSettled(["jpeg","png"].map(function(method){
		return new Promise(function(resolve, reject) {
			if (!opts[method]) return reject();

			// copy primary tile
			const tile = { ...data.tile };

			// fixme: find suitable tile in tiles
			sharp(tile.buffer).toFormat(method, opts[method]).toBuffer(function(err, buffer, info){
				if (err) {
					debug.error("Convert: %s", err);
					return reject();
				};

				// fix tile
				tile.buffer = buffer;
				tile.path = tile.path+"."+method;
				tile.type = method;
				tile.mimetype = "image/"+method;
				tile.headers = { ...tile.headers };

				// add to tile stack
				data.tiles.unshift(tile);

				// set primary if smaller
				if (buffer.length < data.tile.buffer.length) {
					debug.info("Converted '%s': -%db", tile.path.magenta, data.tile.buffer.length-buffer.length);
					data.tile = tile;
				};

				resolve();

			});

		});
	})).then(function(){
		next();
	});

};
