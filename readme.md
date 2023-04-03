# tileblaster

![tileblaster](docs/tileblaster.png)

tileblaster is a versatile caching proxy server for map tiles. it can handle many different tile sources and file formats
and can optimise tiles on the fly and speed up delivery by acting as a cache.

## Awesome things you can do with tileblaster

* Many awesome this FIXME

## What tileblaster isn't

tileblaster is not a tileserver, it does not read raw OpenStreetMap data or create map tiles from scratch; you need to
have a source for map tiles. You can of course use tools like [tilemaker](https://tilemaker.org/) to create your own
tilesets, use freely available ready-made tiles from [Versatiles](https://versatiles.org/) or use another tileserver
if you're allowed to do so.

## Install

`npm i -g tileblaster`

## Configuration

### Maps Configuration

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
	}
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

### Plugins

tileblaster supports plugins. They work just like builtins, but you can load them from the directory specified in `config.paths.plugins`

[Example Plugin](plugins/example.js)

### Nginx

tileblaster is easy to use with nginx acting as a reverse proxy. Here is a simple example:

```
upstream tileblaster {
	server 127.0.0.1:28897;
	# server unix:/path/to/tileblaster.socket; # ← if you use sockets
}

server {

	# ...

	location /tileblaster { # ← set config.server.mount to the same path
		proxy_set_header Host $host;
		proxy_set_header Accept-Encoding $http_accept_encoding;
		proxy_http_version 1.1;
		proxy_pass http://tileblaster;
	}

}

```

## Optional Dependencies

tileblaster has a few optional dependencies, that are mostly used for image manilulation and optimisation (Sharp, MozJPEG, OptiPNG)  or more complex tile sources (Versatiles, PMTiles, MBTiles).

If you don't need them, install tileblaster with `npm i -g tileblaster --no-optional`

## License

[Unlicense](./LICENSE)
