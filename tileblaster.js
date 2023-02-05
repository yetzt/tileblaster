
const http = require("http");
const fs = require("fs");

const router = require("./lib/router");
const debug = require("./lib/debug")("tileblaster");

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;

	self.config = config;

	// default host to localhost if port is set
	if (self.config.port && !self.config.host) self.config.host = "localhost";

	// router
	self.router = router({ mountpoint: "/" }); // FIXME mountpoint from config

	// index route
	self.router.route("/", function(req, res){
		res.statusCode = 200;
		res.setHeader("content-type", "text/plain");
		res.end("tileblaster ready.");
	});

	// default route
	self.router.default(function(req, res){
		res.statusCode = 404;
		res.setHeader("content-type", "text/plain");
		res.end("not found.");
	});

	// listen
	self.listen(self.router.serve);

	return this;
};

// listen handler
tileblaster.prototype.listen = function(router){
	const self = this;

	// listen on port
	if (self.config.port) {
		http.createServer(function(){
			router(...arguments);
		}).listen(self.config.port, self.config.host, function(err){
			if (err) return debug("listen: ERROR binding port '%s:%d':", self.config.host, self.config.port, err);
			debug("listen: listening on '%s:%d'", self.config.host, self.config.port);
		});
	};

	// listen on socket
	if (self.config.socket) {
		fs.unlink(self.config.socket, function(err) { // try unlink leftover socket
			if (err && err.code !== "ENOENT") return debug("listen: ERROR deleting socket '%s':", self.config.socket, err);
			http.createServer(function(){
				router(...arguments);
			}).listen(self.config.socket, function(err) {
				if (err) return debug("listen: ERROR binding to socket '%s':", self.config.socket, err);
				debug("listen: listening on socket '%s'", self.config.socket);
				if (self.config.perms) fs.chmod(self.config.socket, self.config.perms, function(err){
					if (err) return debug("listen: ERROR changing permissions of socket '%s' to '%s':", self.config.perms.toString(8), self.config.socket, err);
					// FIXME chgrp
				});
			});
		});
	}

	return self;
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
