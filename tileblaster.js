
const debug = require("./lib/debug")("tileblaster");

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;


	return this;
};

// run if called directly
if (require.main === module) {
	process.env.DEBUG = process.env.DEBUG || "tileblaster";
	debug("starting tileblaster");
	tileblaster({
		port: 8080,
		...require("./config"),
	});
};
