const config = module.exports = {
	version: 1, // config file format version

	id: "tileblaster", // id of the tileblaster instance, in case you want to run more than one; default: tileblaster

	treads: 1, // number of worker threads in cluster, default: 1
	queue: 10, // number of parallel tile processes per worker, default: 12

	url:   "https://tileserver/tiles", // public url including subdirectory
	mount: "/tiles", // mountpoint override, default: pathname from ${config.paths.base}

	paths: {
		work:    "/path/to/stuff", // the base directory where files (sockets, logs, plugins, ...) go; default: ~/tileblaster
		data:    "/path/to/tiles", // the directory in which cached tiles are saved; default: ${config.paths.work}/data
		logs:    "/path/to/logs", // the directory in which cached tiles are saved; default: ${config.paths.work}/logs
		plugins: "/path/to/plugins", // the directory from which plugins ar loaded; default: ${config.paths.work}/plugins
		sockets: "/path/to/sockets", // the directory i nwhich sockets are created; default: ${config.paths.work}/sockets
	},

	// listen
	listen: [{
		port: 8080, // required
		host: "localhost", // default localhost
	},{
		socket: "test.socket", // required, absolute path or relative to ${config.paths.socket}
		mode: 0o660, // change socket mode to this id
		group: 1000, // change socket group to this is
	}],

	// plugins, relative or absolute paths for local files, npm module names otherwise
	plugins: {
		resize: "./resize.js", // relative path, starting with ./
		convert: "/path/to/convert.js", // absolute path
		optimize: "someplugin", // npm module
	},

	maps: {
		example: [{
			// cors headers
			// they are only useful for standalone servers
			builtin: "cors",
			origins: [ "https://example.org/" ],
		},{
			builtin: "parse", // /z/x/y@r.ext, other formats need plugins; set params and dest
			parse: function(req, next){ // override parse function, req is the raw request
				// do things to get parameters from path
				next(null, {
					params: { param: "1" }, // deliver parameters
					dest: "/path/to/tile/{param}/{param}/blub.{e}{c}", // template for destination
				});
			},
		},{
			builtin: "check",
			zoom: [ 0, 22 ], // min, max
			bbox: [ -180, -90, 180, 90 ], // west, south, east, north
			extensions: [ "png", "jpeg" ], // allowed extensions
			density: [ "", "@2x", "@3x" ], // allowed density markeers
			check: function(params, fn) { // override check function, params from parse
				fn(new Error("Check failed")); // deliver error if check failed
			}
		},{
			builtin: "noop",
			// FIXME: get from cache or memcache? need to figure out formats, need to figure out compression
		},{
			builtin: "tileserver",
			url: "https://{s}.tileserver.example/test/{z}/{x}/{y}{r}.{e}",
			subdomains: [ "a", "b", "x" ], // random chosen and passed in as {s}
			tms: true, // y coordinate is inverted
			headers: {}, // additional headers sent to the backend tileserver
			status: [ 200 ], // expected status code(s)
			mimetypes: [ "image/png", "image/jpeg" ], // expected mime types
		},{
			plugin: "resize",
			size: [ 256, 256 ], // width, height
		},{
			plugin: "convert",
			to: [ "webp", "avif" ]
		},{
			plugin: "optimize",
			methods: [ "mozjpeg", "optipng", "zopflipng", "svgo", "..." ],
		},{
			builtin: "compress",
			methods: [ "br", "gz" ]
		},{
			builtin: "cache",
			duration: "30d",
		},{
			builtin: "memcache",
			server: "",
		},{
			builtin: "deliver", // deliver best matching tile for client
			headers: {}, // additional http headers
		}],
		// more maps
		othermap: [],
	}
};
