const cache = {};

// tileserver backend
module.exports = function({ req, res, opts, data }, next){
	const mime = this.lib.mime;
	const debug = this.lib.debug;
	const strtpl = this.lib.strtpl;
	const retrieve = this.lib.retrieve;

	// cache opts
	if (!cache.hasOwnProperty(data.map)) {
		cache[data.map] = {};

		// success codes, convert to int, filter crap, default 200
		cache[data.map].status = (opts.hasOwnProperty("status")) ? Array.isArray(opts.status) ? opts.status : [ opts.status ] : [ 200 ];
		cache[data.map].status.map(function(status){ return parseInt(status,10); }).filter(function(status){ return !isNaN(status); });
		if (cache[data.map].status.length === 0) cache[data.map].status.push(200);

		// headers
		cache[data.map].headers = opts.headers || {};

		// mime types, make array
		cache[data.map].mimetypes = (opts.hasOwnProperty("mimetypes")) ? Array.isArray(opts.mimetypes) ? opts.mimetypes : [ opts.mimetypes ] : false; // FIXME tolowercase

		// tms
		cache[data.map].tms = opts.tms === true;

		// subdomains
		cache[data.map].subdomains = (opts.hasOwnProperty("subdomains")) ? Array.isArray(opts.subdomains) ? opts.subdomains : [ opts.subdomains ] : false;

		// headers
		cache[data.map].headers = (opts.hasOwnProperty("headers")) ? opts.headers : {};

	};

	// clone params for request
	const params = { ...data.params };

	// flip y for tms maps
	if (cache[data.map].tms) params.y = Math.pow(2,params.z)-params.y-1;

	// set subdomain if configured
	if (cache[data.map].subdomains) params.s = cache[data.map].subdomains[ Date.now() % cache[data.map].subdomains.length ];

	// construct url
	data.tile.url = strtpl(opts.url, params);

	debug.info("Fetching %s", data.tile.url);

	// request
	retrieve({
		url: data.tile.url,
		headers: {
			...cache[data.map].headers,
		},
		followRedirects: true,
		compression: true,
		timeout: 10000,
	}).then(function(resp){

		// check status code
		if (cache[data.map].status && !cache[data.map].status.includes(resp.statusCode)) return next(new Error("Source Tileserver responded with statusCode "+resp.statusCode)); // FIXME set response status?

		const mimetypeComplete = (resp.headers["content-type"]||"application/octet-stream").trim().toLowerCase(); // FIXME keep the charset? parse?
		const mimetype = mimetypeComplete.split(";").shift().trim(); // FIXME keep the charset? parse?

		if (cache[data.map].mimetypes && !cache[data.map].mimetypes.includes(mimetype) && !cache[data.map].mimetypes.includes(mimetypeComplete)) return next(new Error("Source Tileserver responded with mime-type "+mimetype));

		// FIXME this is a mess full of redundant information and undocumented, refactor

		// set tile
		data.tile.buffer = resp.body;
		data.tile.compression = false; // http client always delivers uncompressed
		data.tile.mimetype = opts.mimetype || mimetypeComplete; // override via opts
		data.tile.filetype = opts.filetype || mime.filetype(opts.mimetype || mimetype, data.params.e);

		// params
		data.tile.params = { // tile-specific params, to be changed per-tile
			...data.params,
			c: null, // no compression
			e: data.params.e || data.tile.filetype,
			f: data.params.f || "."+data.tile.filetype,
		};

		// http response
		data.tile.status = (data.tile.buffer.length > 0) ? 200 : 204;
		data.tile.headers = { // tile-specific response headers
			"content-type": data.tile.mimetype,
			"content-length": data.tile.buffer.length,
		};

		// keep around? FIXME
		// data.tile.sourceHeaders = resp.headers;

		// deliver
		next();

	}).catch(function(err){
		next(err);
	});

};
