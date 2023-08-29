const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const decompress = require("./lib/decompress");
const retrieve = require("./lib/retrieve");
const router = require("./lib/router");
const strtpl = require("./lib/strtpl");
const debug = require("./lib/debug");
const store = require("./lib/store");
const tasks = require("./lib/tasks");
const load = require("./lib/load");
const mime = require("./lib/mime");

const quu = require("quu");
const sharp = load("sharp"); // optional dep

const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;

	// configure
	self.config = {};
	self.configure(config);

	// libraries (expose to plugins)
	self.lib = { retrieve, debug, load, tasks, mime, store, strtpl, decompress, sharp };

	// plugins
	self.plugins = {};
	self.loadPlugins(self.config.plugins);

	// load builtins
	self.builtins = {};
	self.loadBuiltins([ "cors", "parse", "check", "noop", "tileserver", "versatiles", "pmtiles", "mbtiles", "edit", "compress", "cache", "deliver", "dump", "modernize", "optimize", "sharp" ]);

	// assemble task lists for maps
	self.maps = {};
	self.prepareMaps();

	self.queue = quu(self.config.queue);

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
		/*
		res.setHeader("content-type", "text/plain");
		res.end("tileblaster ready.");
		*/

		// fancy index page
		res.setHeader("content-type", "text/html");
		res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>tileblaster</title><style>body{display: flex;height: 100vh;width: 100vw;margin: 0;padding: 0;justify-content: center;align-items: center;background: rgb(122,32,168);background: radial-gradient(circle, rgba(122,32,168,1) 8%, rgba(252,70,167,1) 100%);}svg{max-width: 90vw;max-height: 90vh;}</style></head><body><svg width="300" height="300" version="1.1" viewBox="0 50 150 150" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="a" x1="400" x2="325" y1="468.69" y2="425.39" gradientTransform="matrix(3 2.359e-8 -2.359e-8 3 -800 -894.08)" gradientUnits="userSpaceOnUse"><stop stop-color="#8332ff" offset="0"/><stop stop-color="#e816ff" stop-opacity=".99492" offset="1"/></linearGradient><filter id="c" x="-.090127" y="-.084742" width="1.1803" height="1.1695" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3.6361132"/></filter><filter id="b" x="-.060783" y="-.070186" width="1.1216" height="1.1404" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="11.396758"/></filter></defs><g transform="translate(179.54 1.2884)"><g transform="matrix(1.1362 0 0 1.1362 14.238 -16.848)"><path d="m-160.68 91.293-1e-5 64.834 56.148 32.417 56.148-32.417 1e-5 -64.834-56.148-32.417z" fill="#191919" stroke-linecap="round" stroke-width="1.1762"/><g transform="matrix(.22459 -.12967 .12967 .22459 -210.23 70.313)" fill="#31e2ff" filter="url(#b)" opacity=".12376" style="mix-blend-mode:normal"><path d="m137.5 187.23-112.5 194.85 112.5 194.86 150-4e-5 -37.5-64.952-75 5e-5 -75-129.9 37.5-64.951h75l-37.5 64.951 75 129.9 150 1e-5 75-129.9-75-129.9h-75l37.5-64.951-75-1e-5 -37.5 64.951-75 1e-5 37.5-64.951zm150 129.9 75-1e-5 37.5 64.951-37.5 64.951-75-2e-5 -37.5-64.951z" stroke-linecap="round" stroke-width="13.606"/><path d="m137.5 187.23-112.5 194.86 125-173.21 62.5-21.65zm150 0-37.5 64.951 50-43.301 62.5-21.648z" opacity=".18033"/><path d="m225 295.48-87.5 21.65h75zm250 86.604-87.5 108.25-137.5 21.65h150zm-200 173.21-137.5 21.65h150z" opacity=".18033"/></g><path d="m-154.03 95.135-2.6e-4 58.351 50.533 29.176 33.689-19.45-16.844-9.7252-16.844 9.7252-33.689-19.45 1e-4 -19.45 16.844-9.7252-1.1e-4 19.45 33.689 19.45 33.689-19.45 1.86e-4 -38.9-33.689-19.45-16.844 9.7252 9e-5 -19.45-16.844 9.7252-8e-5 19.45-16.845 9.7252 1.1e-4 -19.45zm50.533 9.7248 16.844-9.7252 16.844 9.725-8.8e-5 19.45-16.844 9.7252-16.844-9.725z" fill="#840577" fill-opacity=".39927" stroke-linecap="round" stroke-width="3.5286"/><g transform="matrix(.22459 -.12967 .12967 .22459 -210.23 70.313)"><path d="m137.5 187.23-112.5 194.85 112.5 194.86 150-4e-5 -37.5-64.952-75 5e-5 -75-129.9 37.5-64.951h75l-37.5 64.951 75 129.9 150 1e-5 75-129.9-75-129.9h-75l37.5-64.951-75-1e-5 -37.5 64.951-75 1e-5 37.5-64.951zm150 129.9 75-1e-5 37.5 64.951-37.5 64.951-75-2e-5 -37.5-64.951z" fill="url(#a)" stroke-linecap="round" stroke-width="13.606"/><path d="m137.5 187.23-112.5 194.86 125-173.21 62.5-21.65zm150 0-37.5 64.951 50-43.301 62.5-21.648z" fill="#fff" opacity=".18033"/><path d="m225 295.48-87.5 21.65h75zm250 86.604-87.5 108.25-137.5 21.65h150zm-200 173.21-137.5 21.65h150z" opacity=".18033"/></g><path transform="matrix(.98017 0 0 .98017 -2.0724 2.4526)" d="m-71.412 72.221-5.0958 2.9419v5.8849l-15.288 8.8263h-10.192l-10.193 5.8849-13.386 7.7282-1.2015 0.6935-0.70125 0.40462-25.481 14.711v17.654l5.0963 2.9425 10.192-5.8844 5.0963 2.9419v35.307l5.0958 2.9425 20.385-11.769-5.0963-2.9425v-29.422l10.193-5.8844v-5.8849l5.0958-2.9419v-5.8844l5.0963-2.9424v-5.8844l35.673-20.596-5.0963-2.9425v-5.8844l-5.0958 2.9419z" fill="#010101" filter="url(#c)" opacity=".57673" stroke-width=".23538" style="mix-blend-mode:normal"/><g transform="matrix(.1998 -.11536 .11536 .1998 -191.07 74.765)"><path d="m75 338.79 12.5 21.651-75 129.9 12.5 21.651h100l-12.5-21.651 87.5-151.55z" fill="#949fab"/><path d="m12.5 317.14 37.5-64.952h250l37.5 21.651-37.5 64.952h-275z" fill="#e6e9ed" stroke-linecap="round" stroke-width="4.5354"/><path d="m187.5 360.44h50l-12.5 21.651h-50z" fill="#ed5564" stroke-linecap="round" stroke-width="4.5354"/><path d="m300 252.18-25 43.301-12.5-21.651 12.5-21.651h-25l-25 43.301-11.862-20.546 11.862-22.756h-25l-25 43.301-12.351-21.393 12.352-21.908h100z" fill="#8994a2" stroke-linecap="round" stroke-width="4.5354"/><path d="m337.5 273.83-25 43.301 175-1e-5 -12.5-21.651 12.5-21.651z" fill="#949fab" stroke-linecap="round" stroke-width="4.5354"/><path d="m412.5 273.83 12.5-21.651h25l12.5 21.651h-50" fill="#8994a2" stroke-linecap="round" stroke-width="4.5354"/><path d="m200 338.79 75 1e-5 -12.5 21.651h-75z" fill="#8994a2" stroke-linecap="round" stroke-width="4.5354"/><path d="m12.5 317.14 37.5-64.952h250l-237.5 21.651z" fill="#fff" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m112.5 490.34-12.5-21.651 75-129.9h100l-87.5 21.651z" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m325 295.48 12.5-21.651h150z" fill="#fff" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m312.5 317.14 162.5-21.651 12.5 21.651z" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m337.5 273.83-62.5 64.952h25z" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m87.5 360.44-62.5 151.55-12.5-21.651z" fill="#fff" fill-opacity=".096774" stroke-linecap="round" stroke-width="4.5354"/><path d="m175 382.09h-25l12.5 21.651h-25l12.5 21.651h-25l12.5 21.651h-25l12.5 21.651z" fill-opacity=".13109" stroke-linecap="round" stroke-width="4.5354"/><path d="m175 382.09 12.5-21.651h50z" fill-opacity=".13109" stroke-linecap="round" stroke-width="4.5354"/><path d="m412.5 273.83 12.5-21.651h25z" fill="#fff" fill-opacity=".13109" stroke-linecap="round" stroke-width="4.5354"/></g></g></g></svg></body></html>');

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

		self.queue.push(function(next){ // queue tasks

			args.start = Date.now();
			args.timeout = setTimeout(function(){
				debug.warn("Task timed out: %s (%d total, %d running)", req.path, self.queue.stack.length, self.queue.running);
				res.used = true;
				args.timeout = null;
				next();
			},30000);

			// create tasks from map
			tasks(self.maps[req.map]).run(args, function(err, { res }){

				// check if timed out
				if (args.timeout === null) return;
				clearTimeout(args.timeout);
				debug.info("Task complete: %s (%ds)", req.path, ((Date.now()-args.start)/1000));

				next(); // free queue

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

	});

	// listen
	self.servers = [];
	self.listen(self.router.serve);

	// handle messages from main thred
	process.on("message", function(message){
		if (message === "shutdown") self.shutdown();
		// FIXME: reload config without shutdown?
	});

	// shutdown on SIGINT
	process.on("SIGINT", function(){
		debug.info("SIGINT received");
		self.shutdown();
	});

	// shutdown on SIGTERM
	process.on("SIGTERM", function(){
		debug.info("SIGTERM received");
		self.shutdown();
	});

	return this;
};

// graceful shutdown
tileblaster.prototype.shutdown = function(){
	const self = this;
	self.shutdown = function(){}; // ensure shutdown only runs once
	debug.info("shutting down");
	let closed = 0;
	self.servers.forEach(function(server){
		server.close(function(){
			(function(fn){
				if (!server.socket) return fn();
				fs.unlink(server.socket, fn);
			})(function(){
				if (++closed === self.servers.length) {
					debug.info("All Servers Closed");
					process.exit(0);
				}
			});
		});
	});
	// watchdog
	setTimeout(function(){
		debug.warn("Closing servers timed out");
		process.exit(1);
	},3000);
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
				const fn = function(args, next, skip){
					return self.builtins[job.builtin].call(self, { ...args, opts: job }, next, skip);
				};
				fn.label = job.builtin;
				return fn;
			} else {
				// unknown plugin, pass through
				debug.warn("Unknown builtin '%s' in map '%s'", job.builtin, mapid);
				return function({}, next){ next(); };
			};
		};

		// job is plugin
		if (job.hasOwnProperty("plugin")) {
			if (self.plugins.hasOwnProperty(job.plugin)) {
				const fn = function(args, next, skip){
					return self.plugins[job.plugin].call(self, { ...args, opts: job }, next, skip);
				};
				fn.label = "plugin:"+job.plugin;
				return fn;
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

			// create different sockets per instance
			if (self.config.threads > 1) {
				let ext = path.extname(listen.socket);
				listen.socket = path.join(path.dirname(listen.socket), path.basename(listen.socket, ext) + self.config.id + ext);
			}

			// ensure socket dir exists
			fs.mkdir(path.dirname(listen.socket), { recursive: true }, function(err){
				if (err && err.code !== "ENOENT") return debug.error("Creating socket dir '%s':", path.dirname(listen.socket), err);

				// inlink old socket
				fs.unlink(listen.socket, function(err) { // try unlink leftover socket
					if (err && err.code !== "ENOENT") return debug.error("Deleting socket '%s':", listen.socket, err);

					server.listen(listen.socket, function(err) {
						if (err) return debug.error("Binding to socket '%s':", listen.socket, err);

						// store socket path
						server.socket = listen.socket;

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

			});

		}

	});

	return self;
};
