// check data.params against constraints

const cache = {};

module.exports = function({ req, res, opts, data }, next){

	// fill cache for map
	if (!cache.hasOwnProperty(data.map)) {

		cache[data.map] = {};

		// assume reasonable default if no zoom level was specified
		cache[data.map].zoom = (!opts.zoom || opts.zoom.length === 0) ? [ 0, 24 ] : opts.zoom;

		// find min and max, clamp to reasonable levels FIXME global config?
		cache[data.map].minZoom = Math.max(0, Math.min(...cache[data.map].zoom));
		cache[data.map].maxZoom = Math.min(24, Math.max(...cache[data.map].zoom));

		// expand to array of zoom levels
		cache[data.map].zoomLevels = Array(cache[data.map].maxZoom-cache[data.map].minZoom+1).fill().map(function(v,i){
			return i+cache[data.map].minZoom;
		});

		if (opts.bbox && Array.isArray(opts.bbox) && opts.bbox.length === 4) {

			// sort and clamp bbox to planet
			cache[data.map].bbox = [ // FIXME: sorting prevents some errors, but also bboxes across the antimeridian. maybe some "strict" config?
				Math.max(-180, Math.min(opts.bbox[0], opts.bbox[2])),
				Math.max( -90, Math.min(opts.bbox[1], opts.bbox[3])),
				Math.min( 180, Math.max(opts.bbox[0], opts.bbox[2])),
				Math.min(  90, Math.max(opts.bbox[1], opts.bbox[3])),
			];

			// precalculate tile index bounds per zoom level, clamp to planet
			// hint: tile indexes increment north → south
			// hint: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
			cache[data.map].bounds = cache[data.map].zoomLevels.reduce(function(b,z){
				return b[z] = [
					Math.max(0,(Math.floor((cache[data.map].bbox[0]+180)/360*Math.pow(2,z)))), // west
					Math.max(0,(Math.floor((1-Math.log(Math.tan(cache[data.map].bbox[3]*Math.PI/180)+1/Math.cos(cache[data.map].bbox[3]*Math.PI/180))/Math.PI)/2*Math.pow(2,z)))), // north
					Math.min(Math.pow(2,z)-1,(Math.floor((cache[data.map].bbox[2]+180)/360*Math.pow(2,z)))), // east
					Math.min(Math.pow(2,z)-1,(Math.floor((1-Math.log(Math.tan(cache[data.map].bbox[1]*Math.PI/180)+1/Math.cos(cache[data.map].bbox[1]*Math.PI/180))/Math.PI)/2*Math.pow(2,z)))), // south
				],b;
			},[]);

		} else {

			cache[data.map].bbox = false;
			cache[data.map].bounds = false;

		}

		// allowed extensions
		cache[data.map].extensions = ((opts.extensions) ? ((Array.isArray(opts.extensions)) ? opts.extensions : ((typeof opts.extensions === "string") ? [ opts.extensions ] : [])) : []).map(function(extension){
			return (extension.charCodeAt(0) === 46) ? extension : "."+extension; // ensure leading dot
		});

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

	// check for NaNs
	if (isNaN(data.params.z) || isNaN(data.params.x) || isNaN(data.params.y)) return next(new Error("illegal zxy."));

	// check zoom
	if (data.params.z < cache[data.map].minZoom || data.params.z > cache[data.map].maxZoom) return next(new Error("illegal zoom."));

	// check bounds
	if (cache[data.map].bounds) {
		if (data.params.x < cache[data.map].bounds[data.params.z][0] || data.params.x > cache[data.map].bounds[data.params.z][2]) return next(new Error("x is out of bounds."));
		if (data.params.y < cache[data.map].bounds[data.params.z][1] || data.params.y > cache[data.map].bounds[data.params.z][3]) return next(new Error("y is out of bounds."));
	}

	// check extension
	if (cache[data.map].extensions.length > 0 && !cache[data.map].extensions.includes(data.params.e)) return next(new Error("illegal extension."));

	// check density
	if (cache[data.map].density && !cache[data.map].density.includes(data.params.r)) return next(new Error("illegal density marker."));

	// all passed
	next();

};
