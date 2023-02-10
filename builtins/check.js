// check data.params against constraints

const cache = {};

module.exports = function({ req, res, opts, data }, next){

	// fill cache for map
	if (!cache.hasOwnProperty(data.map)) {

		cache[data.map] = {};

		// assume reasonable default if no zoom level was specified
		cache[data.map].zoom = (!opts.zoom || opts.zoom.length === 0) ? [ 0, 24 ] : opts.zoom;

		// find min and max, clamp to reasonable levels
		cache[data.map].minZoom = Math.max(0, Math.min(...cache[data.map].zoom));
		cache[data.map].maxZoom = Math.min(24, Math.max(...cache[data.map].zoom));

		// expand to array of zoom levels
		cache[data.map].zoomLevels = Array(cache[data.map].maxZoom-cache[data.map].minZoom+1).fill().map(function(v,i){
			return i+cache[data.map].minZoom;
		});

		if (opts.bbox && Array.isArray(opts.bbox) && opts.bbox.length === 4) {

			// clamp bbox to planet and sort latitude
			// longitude might be inverted when bounds span the antimeridian
			cache[data.map].bbox = [
				Math.max(-180, opts.bbox[0]),
				Math.max( -90, Math.min(opts.bbox[1], opts.bbox[3])),
				Math.min( 180, opts.bbox[2]),
				Math.min(  90, Math.max(opts.bbox[1], opts.bbox[3])),
			];

			// precalculate tile index bounds per zoom level, clamp to planet
			// hint: tile indexes increment north → south
			// hint: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

			// clamp tile index to max extent of zoom level
			function clamp(v,z) {
				return Math.max(0,Math.min(Math.pow(2,z)-1,z));
			};

			// tile x of zoom level from longitude
			function lon(x,z) {
				return clamp(Math.floor((x+180)/360*Math.pow(2,z)),z);
			};

			// tile y of zoom level from latitude
			function lat(y,z){
				return clamp(Math.floor((1-Math.log(Math.tan(y*Math.PI/180)+1/Math.cos(y*Math.PI/180))/Math.PI)/2*Math.pow(2,z)),z);
			};

			cache[data.map].bounds = cache[data.map].zoomLevels.reduce(function(b,z){
				return b[z] = [
					lon(cache[data.map].bbox[0],z), // west
					lat(cache[data.map].bbox[3],z), // north
					lon(cache[data.map].bbox[2],z), // east
					lat(cache[data.map].bbox[1],z), // south
				],b;
			},[]);

		} else {

			cache[data.map].bbox = false;
			cache[data.map].bounds = false;

		}

		// allowed extensions
		cache[data.map].extensions = ((opts.extensions) ? ((Array.isArray(opts.extensions)) ? opts.extensions : ((typeof opts.extensions === "string") ? [ opts.extensions ] : [])) : []);

		// density marker
		if (opts.hasOwnProperty("density")) {
			cache[data.map].density = (Array.isArray(opts.density) ? opts.density : [ opts.density ]).map(function(density){
				return (!density) ? null : density;
			});

			if (cache[data.map].density.length === 0) cache[data.map].density = false;

		} else {
			cache[data.map].density = false;
		}

	};
	opts = cache[data.map];

	// check for NaNs
	if (isNaN(data.params.z) || isNaN(data.params.x) || isNaN(data.params.y)) return next(new Error("illegal zxy."));

	// check zoom
	if (data.params.z < opts.minZoom || data.params.z > opts.maxZoom) return next(new Error("illegal zoom."));

	// check bounds
	if (opts.bounds) {
		if (opts.bounds[data.params.z][0] < opts.bounds[data.params.z][2]) { // check for bounds spanning antimeridian
			// bounds don't span antimeridian
			if (data.params.x < opts.bounds[data.params.z][0] || data.params.x > opts.bounds[data.params.z][2]) return next(new Error("x is out of bounds."));
		} else {
			// bounds span antimeridian
			if (data.params.x > opts.bounds[data.params.z][0] && data.params.x < opts.bounds[data.params.z][2]) return next(new Error("x is out of bounds, bounds span antimeridian"));
		}
		if (data.params.y < opts.bounds[data.params.z][1] || data.params.y > opts.bounds[data.params.z][3]) return next(new Error("y is out of bounds."));
	}

	// check extension
	if (opts.extensions.length > 0 && !opts.extensions.includes(data.params.e) && !opts.extensions.includes(data.params.f)) return next(new Error("illegal extension."));

	// check density
	if (opts.density && !opts.density.includes(data.params.d) && !opts.density.includes(data.params.f)) return next(new Error("illegal density marker."));

	// all passed
	next();

};
