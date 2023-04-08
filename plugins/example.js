// bare bones example plugin
module.exports = function({ req, res, opts, data }, next, skip){

	// next() calls the next task
	// skip(name) skips all the next tasks until a plugin or builtin calles `name`, or until the end

	// req and res are your http connection.
	// if you consume res (e.g. send a resonse and call `res.edn()`),
	// then set `res.used = true;` and use skip() to end processing

	// opts contains everything from the config

	// data contains all the data that's passed along
	// data.tile for the "main" tile
	// data.tiles[] for alternative versions

	// let's so something:
	this.lib.debug.info("I'm a plugin!");

	// continue
	next();
};
