// file types and mime types

// look up mime type for extension
module.exports.mimetype = function(ext, dflt){
	return mimetypes[ext] && mimetypes[ext][0] || dflt || "application/octet-stream";
};

// look up file type for mime type
module.exports.filetype = function(mimetype, dflt){
	return filetypes[mimetype] && filetypes[mimetype][0] || dflt || "bin";
};

const mimetypes = {

	// dflt unknown
	bin:  [ "application/octet-stream" ],

	// raster
	png:  [ "image/png" ],
	jpg:  [ "image/jpeg" ],
	jpeg: [ "image/jpeg" ],
	gif:  [ "image/gif" ],
	webp: [ "image/webp" ],
	avif: [ "image/aviv" ],
	tif:  [ "image/tiff" ],
	tiff: [ "image/tiff" ],

	// vector
	svg: [ "image/svg+xml", "image/svg" ],
	mvt: [ "application/vnd.mapbox-vector-tile", "application/x-protobuf", "application/protobuf", "application/vnd.google.protobuf", "application/octet-stream" ],
	pbf: [ "application/x-protobuf", "application/protobuf", "application/vnd.google.protobuf", "application/octet-stream" ],

	// data
	json:     [ "application/json", "text/json" ],
	geojson:  [ "application/geo+json", "application/json", "text/json" ],
	topojson: [ "application/topo+json", "application/json", "text/json" ],

	// containers
	versatiles: [ "application/x-versatiles", "application/vnd.versatiles", "application/octet-stream" ],
	cloudtiles: [ "application/x-cloudtiles", "application/vnd.cloudtiles", "application/octet-stream" ],
	pmtiles:    [ "application/x-pmtiles", "application/vnd.pmtiles", "application/octet-stream" ],
	mbtiles:    [ "application/vnd.sqlite3", "application/x-sqlite3", "application/sqlite3", "application/vnd.mbtiles", "application/x-mbtiles", "application/mbtiles", "application/octet-stream" ],

};

const filetypes = Object.entries(mimetypes).reduce(function(lookup, [ extension, types ]){
	types.forEach(function(type){
		lookup[type] = [ ...(lookup[type]||[]), extension ];
	});
	return lookup;
},{});
