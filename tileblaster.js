
const router = require("./lib/router");
const debug = require("./lib/debug")("tileblaster");

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;

	// router
	self.router = router({ mountpoint: "/" }); // FIXME mountpoint from config

	// index route
	self.router.route("/", function(req, res){
		res.statusCode = 200;
		res.setHeader("content-type", "text/plain");
		res.end("tileblaster ready.");
	});

	// index route
	self.router.default(function(req, res){
		res.statusCode = 404;
		res.setHeader("content-type", "text/plain");
		res.end("not found.");
	});


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
