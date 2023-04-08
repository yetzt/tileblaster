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

		cache[data.map].url = opts.url;

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
	opts = cache[data.map];

	// clone params for request
	const params = { ...data.req.params };

	// flip y for tms maps
	if (opts.tms) params.y = Math.pow(2,params.z)-params.y-1;

	// set subdomain if configured
	if (opts.subdomains) params.s = opts.subdomains[ Date.now() % opts.subdomains.length ];

	const tileurl = strtpl(opts.url, params);

	// FIXME check fails cache

	debug.info("Fetching %s", tileurl);

	// request
	retrieve({
		url: tileurl,
		headers: {
			...opts.headers,
		},
		followRedirects: true,
		compression: true,
		timeout: 10000,
	}).then(function(resp){

		// FIXME cache fails

		// check response status code
		if (opts.status && !opts.status.includes(resp.statusCode)) return next(new Error("Source Tileserver responded with statusCode "+resp.statusCode)); // FIXME set response status?

		// get respose media type
		const contenttype = (resp.headers["content-type"]||"application/octet-stream").trim().toLowerCase();
		const mediatype = contenttype.includes(";") ? contenttype.slice(0, contenttype.indexOf(";")) : contenttype;

		// check response mime type
		if (opts.mimetypes && !opts.mimetypes.includes(mediatype)) return next(new Error("Source Tileserver responded with disallowed mime-type "+mediatype));

		// set tile
		const tile = {};
		tile.path = data.req.path;
		tile.buffer = resp.body;
		tile.mimetype = opts.mimetype || mediatype; // override via opts
		tile.type = opts.filetype || mime.filetype(opts.mimetype || mediatype, data.req.params.e);

		// http response
		tile.status = (tile.buffer.length > 0) ? 200 : 204;

		// defaults
		tile.headers = {};
		tile.compression = false; // http client always delivers uncompressed
		tile.language = null;
		tile.expires = true; // default policy

		// keep around? FIXME
		// data.tile.sourceHeaders = resp.headers;

		// add to tile stack, set primary tile
		data.tiles.unshift(tile);
		data.tile = tile;

		next();

	}).catch(function(err){
		next(err);
	});

};
