const config = module.exports = {
	version: 1, // config file format version

	id: "tileblaster", // id of the tileblaster instance, in case you want to run more than one; default: tileblaster

	threads: 1, // number of worker threads in cluster, default: 1
	queue: 10, // number of parallel tile processes per worker, default: 12

	server: {
		url:   "https://tileserver/tiles", // public url including subdirectory
		mount: "/tiles", // mountpoint override, default: pathname from ${config.paths.base}
	},

	paths: {
		work:    "/path/to/stuff",   // the base directory where files (sockets, logs, plugins, ...) go; default: ~/tileblaster
		data:    "/path/to/tiles",   // the directory in which cached tiles are saved; default: ${config.paths.work}/data
		logs:    "/path/to/logs",    // the directory in which cached tiles are saved; default: ${config.paths.work}/logs
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
		resize: "./resize.js", // path relative to `config.paths.plugins`, starting with ./
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
			builtin: "parse", // /z/x/y@r.ext, other formats via parse function
			parse: function(req, next){ // override parse function, req is the raw request

				// req.url=/foo/bar/{z}.{x}.{y}
				let p = req.url.split("/").pop().split(".");

				// do things to get parameters from path
				next(null, {
					z: p[0],
					x: p[1],
					y: p[2],
					r: "",
					w: 256,
					d: 1,
					e: ".png"
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
			},
			status: 204,
			hints: true,
		},{ // get from cache, skip to `skipto` if successful
			builtin: "cache",
			skipto: "deliver",
		},{
			builtin: "noop", // does nothing
		},{
			builtin: "tileserver",
			url: "https://{s}.tileserver.example/test/{z}/{x}/{y}{r}.{e}",
			subdomains: [ "a", "b", "x" ], // random chosen and passed in as {s}
			tms: true, // y coordinate is inverted
			headers: {}, // additional headers sent to the backend tileserver
			status: [ 200 ], // expected status code(s)
			mimetypes: [ "image/png", "image/jpeg" ], // expected mime types
			mimetype: "image/png", // overwrite mime type from server
		},
		/* alternative:
		{
			// get tile from versatiles container
			builtin: "versatiles",
			url: "https://cdn.example/planet.versatiles",
			headers: { // headers sent to versatiles server
				"X-Tileblaster": "True",
			},
		},{
			// get tiles from pmtiles container
			builtin: "pmtiles",
			url: "https://cdn.example/planet.pmtiles"
		},{
			// get tiles from local mbtiles database
			builtin: "mbtiles",
			file: "/path/to/planet.mbtiles"
		},
		*/
		{
			// edit vectortile
			builtin: "edit",
			edit: function(layers){

				// remove unused layer
				layers = layers.filter(function(layer){
					return (layer.name !== "unused-layer");
				});

				return layers;
			}
		},{
			// use sharp for image manipulation
			plugin: "sharp",
			resize: { width: 512, height: 512 }, // sharp.resize()
		},{
			plugin: "optimize",
			png: { o: 4 }, // true or opts for optipng
			jpeg: true, // true or opts for mozjpeg
		},{
			// convert raster tiles to webp and/or avif
			builtin: "modernize",
			webp: {
				quality: 90,
				effort: 4,
			},
			avif: {
				quality: 90,
				effort: 5,
			},
		},{
			builtin: "compress",
			brotli: 8, // true or <level> or {opts}
			gzip: true, // true or <level> or {opts}
		},{
			builtin: "cache",
			expires: "30d",
		},{
			// debug output
			builtin: "dump",
		},{
			builtin: "deliver", // deliver best matching tile for client
			headers: {}, // additional http headers
		}],
		// more maps
		othermap: [],
	}
};
