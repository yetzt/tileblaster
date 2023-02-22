const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const retrieve = require("./lib/retrieve");
const router = require("./lib/router");
const strtpl = require("./lib/strtpl");
const debug = require("./lib/debug");
const tasks = require("./lib/tasks");
const load = require("./lib/load");
const mime = require("./lib/mime");

const sharp = load("sharp"); // optional dep

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;

	// configure
	self.config = {};
	self.configure(config);

	// libraries (expose to plugins)
	self.lib = { retrieve, debug, load, tasks, mime, strtpl, sharp };

	// plugins
	self.plugins = {};
	self.loadPlugins(self.config.plugins);

	// load builtins
	self.builtins = {};
	self.loadBuiltins([ "cors", "parse", "check", "noop", "tileserver", "versatiles", "compress", "cache", "memcache", "deliver", "dump", "modernize" ]);

	// assemble task lists for maps
	self.maps = {};
	self.prepareMaps();

	// cleanup? TODO

	// router
	self.router = router({ mountpoint: self.config.server.mount });

	// default route
	self.router.default(function(req, res){
		res.statusCode = 404;
		res.setHeader("content-type", "text/plain");
		res.end("not found.");
	});

	// index route
	self.router.route("/", function(req, res){
		res.statusCode = 200;
		res.setHeader("content-type", "text/plain");
		res.end("tileblaster ready.");
	});

	// map use
	self.router.use(function(req, res, next){
		req.steps = (req.path) ? req.path.split("/").slice(1) : [];
		if (self.config.maps.hasOwnProperty(req.steps[0])) {
			req.route = "@map";
			req.map = req.steps[0];
			req.tilepath = "/"+req.steps.slice(1).join("/");
		};
		next();
	});

	// map route
	self.router.route("@map", function(req, res){

		// mark response stream if something pipes into it
		// to avoid sending to response stream twice
		res.once("pipe", function(){
			res.piped = true;
		});

		// assemble args and initial data
		const args = {
			req, res,
			data: {
				map: req.map,
				req: {},
				tile: {
					default: true,
					// default tile
					dest: req.path, // destination file - modification use extensions?
					buffer: Buffer.alloc(0), // empty buffer
					status: 204,
					headers: {
						"expires": new Date(Date.now()).toUTCString(),
					}, // response header specific to tile
					// explicit mimetye
					mimetype: "application/octet-stream", // mimetype
					type: "bin", // type
					compression: false,
					language: null,
					expires: true, // instant expires
				},
				tiles: [], // modified versions
			}
		};

		// create tasks from map
		tasks(self.maps[req.map]).run(args, function(err, { res }){

			// FIXME provide more context
			if (err) debug.error(err);

			// end if response is already sent
			if (!res.writable || res.destroyed || res.finished || res.closed || res.piped) return; // FIXME handle errors anyway

			// send default error FIXME configure verbose errors
			if (err) {
				res.statusCode = 500;
				res.setHeader("content-type", "text/plain");
				res.end("Error.");
				return;
			};

			// default response: no content
			res.statusCode = 200; // FIXME 204
			res.setHeader("content-length", "0");
			res.end("");
			return;

		});

	});

	// listen
	self.servers = [];
	self.listen(self.router.serve);

	return this;
};

// prepare jobs for maps
tileblaster.prototype.prepareMaps = function(){
	const self = this;
	self.maps = Object.entries(self.config.maps).reduce(function(maps, [ mapid, map ]){
		maps[mapid] = self.prepareJobs(mapid, map);
		return maps;
	},{});

	return this;
};

// prepare jobs FIXME merge with prepareMaps?
tileblaster.prototype.prepareJobs = function(mapid, map){
	const self = this;
	return map.map(function(job){

		// job is a straight function
		if (typeof job === "function") return job;

		// if not an object, passthrough
		if (typeof job !== "object") {
			debug.warn("Invalid Task in map '%s'", mapid);
			return function({}, next){ next(); };
		};

		// job is builtin
		if (job.hasOwnProperty("builtin")) {
			if (self.builtins.hasOwnProperty(job.builtin)) {
				return function(args, fn){
					return self.builtins[job.builtin].call(self, { ...args, opts: job }, fn);
				};
			} else {
				// unknown plugin, pass through
				debug.warn("Unknown builtin '%s' in map '%s'", job.builtin, mapid);
				return function({}, next){ next(); };
			};
		};

		// job is plugin
		if (job.hasOwnProperty("plugin")) {
			if (self.plugins.hasOwnProperty(job.plugin)) {
				return function(args, fn){
					return self.plugins[job.plugin].call(self, { ...args, opts: job }, fn);
				};
			} else {
				// unknown plugin, pass through
				debug.warn("Unknown plugin '%s' in map '%s'", job.plugin, mapid);
				return function({}, next){ next(); };
			};
		};

		// unknown job type, passthrough with warning
		debug.warn("Invalid Task type in map '%s'", reqmapid);
		return function({}, next){ next(); };

	});
};

// load builtins
tileblaster.prototype.loadBuiltins = function(builtins){
	const self = this;
	self.builtins = builtins.reduce(function(builtins, builtin){
		let builtinPath = path.resolve(__dirname,"builtins",builtin);
		if (load.exists(builtinPath)) {
			debug.info("Loaded builtin '%s'", builtin);
			builtins[builtin] = require(builtinPath);
		} else {
			debug.warn("Missing builtin: '%s'", builtin);
		};
		return builtins;
	},{});
	return this;
};

// load plugins
tileblaster.prototype.loadPlugins = function(){
	const self = this;

	self.plugins = Object.entries(self.config.plugins).reduce(function(plugins, [ name, plugin ]){

		let pluginname = name.trim().toLowerCase().replace(/[^a-z0-9\-\_\.]+/g,'');
		if (pluginname !== name) debug.warn("Warning: Plugin name has been sanitized: '%s' → '%s'", name, pluginname);

		try {
			if (load.exists(plugin)) {
				plugins[pluginname] = require(plugin);
				debug.info("Loaded Plugin '%s'", pluginname);
			} else {
				let localPlugin = path.resolve(self.config.paths.plugins, plugin);
				if (load.exists(localPlugin)) {
					plugins[pluginname] = require(localPlugin);
					debug.info("Loaded Plugin '%s'", pluginname);
				} else {
					let packagePlugin = path.resolve(__dirname, "plugins", plugin);
					if (load.exists(packagePlugin)) {
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
	if (!self.config.server.url) self.config.server.url = "/";
	if (!self.config.server.mount) self.config.server.mount = (self.config.server.url === "/") ? "/" : self.config.server.url.replace(/^https?:\/\/.*?\//,"/");

	// remove trailing slashes from url and mount
	while (self.config.server.url.length > 1 && self.config.server.url.charCodeAt(self.config.server.url.length-1) === 47) self.config.server.url = self.config.server.url.slice(0, -1);
	while (self.config.server.mount.length > 1 && self.config.server.mount.charCodeAt(self.config.server.mount.length-1) === 47) self.config.server.mount = self.config.server.mount.slice(0, -1);

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

	// maps
	self.config.maps = Object.entries(config.maps).reduce(function(maps, [ id, map ]){
		let mapid = id.trim().toLowerCase().replace(/[^a-z0-9\-\_\.]+/g,'');
		if (mapid !== id) debug.warn("Warning: Map id has been sanitized: '%s' → '%s'", id, mapid);
		maps[mapid] = map;
		return maps;
	},{});

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
