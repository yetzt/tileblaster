
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const router = require("./lib/router");
const debug = require("./lib/debug");
const mod = require("./lib/req");

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;

	// configure
	self.config = {};
	self.configure(config);

	// plugins
	self.plugins = {};
	self.loadPlugins(self.config.plugins);

	// router
	self.router = router({ mountpoint: self.config.mount });

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

// load plugins
tileblaster.prototype.loadPlugins = function(){
	const self = this;

	self.plugins = Object.entries(self.config.plugins).reduce(function(plugins, [ name, plugin ]){

		let pluginname = name.trim().toLowerCase().replace(/[^a-z0-9\-\_\.]+/g,'');
		if (pluginname !== name) debug.warn("Warning: Plugin name has been sanitized: '%s' → '%s'", name, pluginname);

		try {
			if (mod.exists(plugin)) {
				plugins[pluginname] = require(plugin);
				debug.info("Loaded Plugin '%s'", pluginname);
			} else {
				let localPlugin = path.resolve(self.config.paths.plugins, plugin);
				if (mod.exists(localPlugin)) {
					plugins[pluginname] = require(localPlugin);
					debug.info("Loaded Plugin '%s'", pluginname);
				} else {
					let packagePlugin = path.resolve(__dirname, "plugins", plugin);
					if (mod.exists(packagePlugin)) {
						plugins[pluginname] = require(packagePlugin);
						debug.info("Loaded Plugin '%s'", pluginname);
					} else {
						debug.warn("Error loading plugin '%s': Not found", pluginname);
					}
				}
			}
		} catch(err) {
			debug.warn("Error loading plugin '%s':", pluginname, err);
		}

		return plugins;

	},{});

	return this;
};

// read config and fill in the blanks
tileblaster.prototype.configure = function(config){
	const self = this;

	// check config file version
	if (!config.hasOwnProperty("version") || config.version !== 1) {
		debug.error("Config has no version property. Possibly an old config file? Exiting.")
		process.exit(1);
	};

	// check if any maps are configured
	if (!config.hasOwnProperty("maps") || Object.keys(config.maps) === 0) {
		debug.error("Config has no maps configured. Exiting.")
		process.exit(1);
	};

	// check if any listen instructions are given
	if (!config.hasOwnProperty("listen") || config.listen.length === 0) {
		debug.error("Config has no listen instructions. Exiting.")
		process.exit(1);
	};

	// set config
	self.config = {
		id: "tileblaster",
		threads: 1,
		queue: 12,
		url: null,
		mount: null,
		paths: {},
		plugins: {},
		listen: [],
		maps: {},
		...config,
	};

	// clamp number of threads to number of cores and queue size
	self.config.threads = Math.max(1, Math.min(self.config.threads, os.cpus().length));
	self.config.queue = Math.max(1, Math.min(self.config.queue, 100));

	// warn user if queue size is less than 12 over all threads
	if ((self.config.queue * self.config.threads) < 12) debug.warn("Warning: Queue size of %d is pretty small.", self.config.queue);

	// url and mount
	if (!self.config.url) self.config.url = "/";
	if (!self.config.mount) self.config.mount = (self.config.url === "/") ? "/" : self.config.url.replace(/^https?:\/\/.*?\//,"/");

	// remove trailing slashes from url and mount
	while (self.config.url.length > 1 && self.config.url.charCodeAt(self.config.url.length-1) === 47) self.config.url = self.config.url.slice(0, -1);
	while (self.config.mount.length > 1 && self.config.mount.charCodeAt(self.config.mount.length-1) === 47) self.config.mount = self.config.mount.slice(0, -1);

	// paths
	if (!self.config.paths.work) self.config.paths.work = path.resolve(os.homedir(), "tileblaster");
	["data","logs","plugins","sockets"].forEach(function(p){
		if (!self.config.paths[p]) self.config.paths[p] = path.resolve(self.config.paths.work, p);
	});

	// default host to localhost if port is set
	if (self.config.port && !self.config.host) self.config.host = "localhost";

	// listen
	self.config.listen = self.config.listen.filter(function(listen){
		return listen.hasOwnProperty("port") || listen.hasOwnProperty("socket");
	}).map(function(listen){
		// ensure hostname is set
		if (listen.hasOwnProperty("port")) {
			if (typeof listen.port !== "number") listen.port = parseInt(listen.port,10);
			if (!listen.host) listen.host = "localhost";
		}
		else if (listen.hasOwnProperty("socket")) {
			listen.socket = path.resolve(self.config.paths.sockets, listen.socket);
		};
		return listen;
	}).filter(function(listen){
		// check for port and host types and NaN
		return listen.socket || (!isNaN(listen.port) && typeof listen.host === "string");
	});

	// check again if any listen instructions are given
	if (self.config.listen.length === 0) {
		debug.error("Config has no valid listen instructions. Exiting.")
		process.exit(1);
	};

	// plugins FIXME resolve

	// maps
	config.maps = Object.entries(config.maps).reduce(function(maps, [ id, map ]){
		let mapid = id.trim().toLowerCase().replace(/[^a-z0-9\-\_\.]+$/g,'');
		if (mapid !== id) debug.warn("Warning: Map id has been sanitized: '%s' → '%s'", id, mapid);
		maps[mapid] = map;
		return maps;
	},{});

	// cleanup FIXME?

	return this;
};

// listen handler
tileblaster.prototype.listen = function(router){
	const self = this;

	self.config.listen.forEach(function(listen){

		const server = http.createServer({ keepAlive: true }, function(){
			router.call(self.router, ...arguments);
		});

		if (listen.port) {

			server.listen(listen.port, listen.port, function(err){
				if (err) return debug.error("listen: ERROR binding port '%s:%d':", listen.host, listen.port, err);
				debug.info("Listening on '%s:%d'", listen.host, listen.port);
				self.servers.push(server);
			});

		} else if (listen.socket) {

			fs.unlink(listen.socket, function(err) { // try unlink leftover socket
				if (err && err.code !== "ENOENT") return debug.error("Deleting socket '%s':", listen.socket, err);
				server.listen(listen.socket, function(err) {
					if (err) return debug.error("Binding to socket '%s':", listen.socket, err);
					debug.info("Listening on socket '%s'", listen.socket);
					self.servers.push(server);
					if (listen.mode) fs.chmod(listen.socket, listen.mode, function(err){
						if (err) return debug.error("Changing permissions of socket '%s' to '%s':", listen.socket, listen.perms.toString(8), err);
					});
					if (listen.group) fs.chown(listen.socket, os.userInfo().uid, listen.group, function(err){
						if (err) return debug.error("Changing gid of socket '%s' to '%s':", listen.socket, listen.gid, err);
					});
				});
			});

		}

	});

	return self;
};

// run if called directly
if (require.main === module) {
	process.env.DEBUG = process.env.DEBUG || "tileblaster";
	debug("starting tileblaster");
	tileblaster({
		version: 1,
		listen: [{ port: 8080 }],
		maps: { example: [] },
		...require("./config"),
	});
};
