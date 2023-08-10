# tileblaster configuration

tileblaster configuration lives in a javascript (common js) file, that exports an object containing the configuration.

## Example

See [config.dist.js](./config.dist.js)

## Properties

#### `version`

config file format version. Always `1` fro now.

#### `id`

id of the tileblaster instance, in case you want to run more than one; default: `tileblaster`

#### `treads`

number of worker threads in cluster, default: 1

#### `queue`

number of concurrently processed tiles per worker, default: 12

#### `server.url`

public url including subdirectory

#### `server.mount`

mountpoint override, default: pathname of `config.paths.url`

#### `paths.work`

the base directory where files (sockets, logs, plugins, ...) go; default: `~/tileblaster`

#### `paths.data`

the directory in which cached tiles are saved; default: `${config.paths.work}/data`

#### `paths.logs`

the directory in which cached tiles are saved; default: `${config.paths.work}/logs`

#### `paths.plugins`

the directory from which plugins ar loaded; default: `${config.paths.work}/plugins`

#### `paths.sockets`

the directory i nwhich sockets are created; default: `${config.paths.work}/sockets`

### `listen`

an array of server listen configurations. these contain either `port` or `socket`

``` js
listen: [{
	port: 8080, // required
	host: "localhost", // default localhost
},{
	socket: "test.socket", // required, absolute path or relative to ${config.paths.socket}
	mode: 0o660, // change socket mode to this id
	group: 1000, // change socket group to this is
}],
```

### `plugins`

plugins, relative or absolute paths for local files, npm module names otherwise

``` js
plugins: {
	resize: "./resize.js", // relative path, starting with ./
	convert: "/path/to/convert.js", // absolute path
	optimize: "someplugin", // npm module
},
```

### `maps`

each property of this object represents a map and its workflow. the workflow is an array
of `builtin` and `plugin` directives, that get processed in the order of their definition.

``` js
{
	// a map with id "example"
	example: [{
		// a builtin directive, processed first
		builtin: "something",
		// ...
	},{
		// a plugin directive, processed second
		plugin: "some-plugin",
		// ...
	},{
		// ...
	}],
	anoterMap: {
		// ...
	}
}
```

### Builtins

#### `cors`

Send [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) Headers to the client. Can be limited by Origin.
You should do this in your reverse proxy though.

``` js
{
	builtin: "cors",
	origins: [ "https://example.org/" ],
	// origins: [ "*" ], // ← allow anyone
}
```

#### `parse`

Parse a client request. You can override this with your own parse function in case
your client requires the use of a non-standard request uri or uses GET/POST data or whatever.

``` js
{
	builtin: "parse", // /z/x/y@r.ext, other formats need plugins; set params and dest
	parse: function(req, next){ // override parse function, req is the raw request
		// do things to get parameters from path
		next(null, {
			params: { param: "1" }, // deliver parameters
			dest: "/path/to/tile/{param}/{param}/blub.{e}{c}", // template for destination
		});
	},
}
```

#### `check`

Limits request dependent on parameters. You can deny access to tiles to certain zoom levels,
within a bounding box, to specific extensions and densities, or use your own check function.

``` js
{
	builtin: "check",
	zoom: [ 0, 22 ], // min, max
	bbox: [ -180, -90, 180, 90 ], // west, south, east, north
	extensions: [ "png", "jpeg" ], // allowed extensions
	density: [ "", "@2x", "@3x" ], // allowed density markeers
	check: function(params, fn) { // override check function, params from parse
		fn(new Error("Check failed")); // deliver error if check failed
	},
	status: 204, // http status code delivered on fail; default: 204
	hints: false, // send `x-tileblaster-hint` header with error message
}
```

#### `cache`

Local tile cache.

##### Retrieve cached tiles

When no main tile is availabe, try to load it from cache.

``` js
{
	builtin: "cache",
	skipto: "deliver", // skip to this builtin when tile loaded from cache
}
```

##### Store tiles

If a tile is set, store it in the local cache.

``` js
{
	builtin: "cache",
	expires: "30d", // duration or seconds or `true` or `false`
}
```

* `expires: 300` - Expires after this amount of seconds
* `expires: "5y 2w 1d 5h 30m 4s"` - Expires after this [duration](https://www.npmjs.com/package/dur#user-content-time-units)
* `expires: false` - Expires never
* `expires: true` - Expires instantly

#### `noop`

Does nothing and has no real purpose.

#### `tileserver`

Fetch a tile from a tileserver via http(s).

``` js
{
	builtin: "tileserver",
	url: "https://{s}.tileserver.example/test/{z}/{x}/{y}{r}.{e}",
	subdomains: [ "a", "b", "x" ], // random chosen and passed in as {s}
	tms: true, // y coordinate is inverted
	headers: {}, // additional headers sent to the backend tileserver
	status: [ 200 ], // expected status code(s)
	mimetypes: [ "image/png", "image/jpeg" ], // expected mime types
	mimetype: "image/png", // overwrite mime type from server
}
```

#### `versatiles`

Fetch a tile from a local or remote [versatiles](https://versatiles.org) container.

*Pro Tip:* Don't pay MapBox or "Open"MapTiles for limited access to Open Data! You can get completely free Vectortiles in [Shortbread Schema](https://shortbread.geofabrik.de/schema/) at [download.versatiles.org](https://download.versatiles.org/).

``` js
{
	// get tile from versatiles container
	builtin: "versatiles",
	url: "https://cdn.example/planet.versatiles",
	// url: "/path/to/planet.versatiles",
	tms: false, // y coordinate is inverted
	headers: { // headers sent to versatiles server
		"X-Tileblaster": "True",
	},
}
```

#### `pmtiles`

Fetch a tile from a pmtiles container.

``` js
{
	// get tile from versatiles container
	builtin: "pmtiles",
	url: "https://cdn.example/planet.pmtiles",
	// url: "/path/to/planet.pmtiles",
}
```
#### `mbtiles`

Retrieve a tile from a mbtiles database.

``` js
{
	// get tile from versatiles container
	builtin: "mbtiles",
	file: "/path/to/planet.mbtiles",
}
```

#### `edit`

Edit vectortiles

``` js
{
	builtin: "edit",
	edit: function(layers){

		// remove unused layer
		layers = layers.filter(function(layer){
			return (layer.name !== "unused-layer");
		});

		return layers;
	},
}
```

#### `resize`

**Not yet implemented** FIXME

#### `modernize`

Convert JPEG or PNG raster tiles to WebP or AVIF.
The resulting tile with the smallest size and a format the client supports becomes the main tile.

``` js
{
	builtin: "modernize",
	webp: {
		quality: 90,
		effort: 4,
	},
	avif: {
		quality: 90,
		effort: 5,
	},
}
```

#### `optimize`

Optimise raster tiles with `mozjpeg` or `optipng`. Only results smaller than the original are kept.

``` js
{
	plugin: "optimize",
	png: { o: 4 }, // true or opts for optipng
	jpeg: true, // true or opts for mozjpeg
}
```

#### `compress`

Compresses all `data.tiles` with brotli and/or gzip. The tile with the smallest size and a compression the client supports becomes the main tile.

``` js
{
	builtin: "compress",
	brotli: 8, // true or <level> or {opts}
	gzip: true, // true or <level> or {opts}
}
```


#### `deliver`

Sends `data.tile` to the client. Adds configured response headers.

``` js
{
	"builtin": "deliver",
	"headers": {
		"X-My-Header": "This is a very good header"
	}
}
```

#### `dump`

Ends all processing and dumps the contents of `data` the console and browser.

Useful for debugging.

``` js
{
	"builtin": "dump"
}
```