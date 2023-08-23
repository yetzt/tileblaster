// send cors headers.

module.exports = function({ req, res, opts, data }, next){

	// only if origin header is set
	if (!req.headers.hasOwnProperty("origin") || !req.headers.origin) return next();

	// check origin in opts
	if (!opts.hasOwnProperty("origins")) return next();

	// ensure opts.origins is array of strings
	if (!Array.isArray(opts.origins)) opts.origins = [ opts.origins ].filter(o=>typeof o === "string");

	// check if origin is allowed cors
	if (!opts.origins.includes("*") && opts.origins.includes(req.headers.origin)) return next();

	// send common headers
	res.setHeader("Vary", "Origin"); // important for caching
	res.setHeader("Access-Control-Allow-Origin", req.headers.origin||"*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "DNT,If-None-Match,If-Modified-Since,Cache-Control,Content-Type,Range,Accept-Encoding");
	res.setHeader("Access-Control-Expose-Headers", "Content-Length,Content-Range,Etag,Last-Modified,Content-Encoding");

	// if method is OPTGIONS, set Access-Control-Max-Age and bail
	if (req.method === "OPTIONS") {
		res.setHeader("Access-Control-Max-Age", 1728000);
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.setHeader("Content-Length", 0);
		res.statusCode = 204;
		res.end();
	};

	next();
};
