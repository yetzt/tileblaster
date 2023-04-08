# Examples

## Tileserver

Serve tiles from a tileserver

``` js
{
	example: [{
		// takes a request for /map/0/1/2@2x.png and breaks it down into z=0, x=1, y=2, r=@2x and e=png
		builtin: "parse",
		/* but you can override this if you need to
		parse: function(req, fn){
			// `req` is the http request object
			let fragments = req.url.split("/").pop().split(".");
			// fn is a callback to deliver the pares parameters
			fn(null, {
				z: fragments[0], x: fragments[1], y: fragments[2],
				e: fragments[3], // extension
				r: "@2x", // density marker
				d: 2,     // density
				w: 512,   // tile width
			});
		}
		*/
	},{
		// source tileserver
		builtin: "tileserver",
		url: "https://{s}.tileserver.example/{z}/{x}/{y}{r}.{e}?access_token=YOUR_OPENDATAGRIFTBOXTILER_ACCESS_TOKEN",
		// optional:
		subdomains: [ "a", "b", "c" ], // random chosen and passed in as {s}
		tms: false, // {y} is inverted
		headers: { // additional headers sent to tileserver
			"Origin": "https://totally-legit-website.example/",
			"User-Agent": "uncoolest-mobile-map-app"
		},
		status: [ 200 ], // expected status code(s)
		mimetypes: [ "image/png", "image/jpeg" ], // expected mime types
	},{
		builtin: "deliver"
	}]
}
```

## Versatiles

Serve tiles from a versatiles container

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "versatiles",
		url: "https://cdn.example/planet.versatiles",
	},{
		builtin: "deliver"
	}]
}
```

## PMTiles

Serve tiles from a pmtiles container

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "pmtiles",
		url: "https://cdn.example/planet.pmtiles",
	},{
		builtin: "deliver"
	}]
}
```

## MBTiles

Serve tiles from an mbtile database

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "mbtiles",
		file: "/path/to/file.mbtiles",
	},{
		builtin: "deliver"
	}]
}
```

## Check parameters

Limit access to tiles by zoom level, bbox, extension or density marker with `check` builtin

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "check",
		zoom: [ 0, 10 ], // min, max
		bbox: [ -180, -85, 180, 85 ], // west, south, east, north
		extensions: [ "png", "jpeg" ], // allowed extensions
		density: [ "", "@2x" ], // allowed density markers
	},{
		// source tileserver
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}{r}.{e}",
	},{
		builtin: "deliver"
	}]
}
```

## Raster tile optimization and conversion

`optimize` will attemt to reduce the raster tile size by applying image optimization, `mozjpeg` for `jpeg` tiles, `optipng` for `png` tiles.
`modernize` will convert raster tiles to `webp` and `avif` format (using `sharp`) and deliver those to capable clients.

``` js
{
	example: [{
		builtin: "parse",
	},{
		// source tileserver
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}.{e}",
	},{
		builtin: "optimize",
		jpeg: {}, // use mozjpeg via wasm for jpeg tiles
		png: { o: "3", strip: "all" }, // use optipng via wasm for png tiles
	},{
		builtin: "modernize",
		webp: {
			quality: 85, // good enough quality
			effort: 3, // don't use much effort
		},
		avif: {
			quality: 100, // 100% quality
			lossless: true, // lossless only
			effort: 9, // a lot of effort
		}
	},{
		builtin: "deliver"
	}]
}
```

## Raster tile image manipulation

Use [sharp](https://www.npmjs.com/package/sharp) to manipulate raster tiles.
Example: convert a raster tile to "dark mode" by inverting the colors and rotating the hue.

``` js
{
	example: [{
		builtin: "parse",
	},{
		// source tileserver
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}.png",
	},{
		builtin: "sharp", // use builtin sharp
		negate: {}, // invert colors using sharp.negate()
		modulate: { hue: 180 }, // rotate hue by 180° using sharp.modulate({ hue: 180 })
	},{
		builtin: "deliver"
	}]
}
```

## Edit vector tiles

Use [vtt](https://npmjs.com/package/vtt) to edit vectortiles.

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}.pbf",
	},{
		builtin: "edit", // use builtin edit
		edit: function(layers){
			// `layers` is ja JSON representation of the layers in a tile
			// return the edited `layers` data
			return layers.filter(function(layer){
				return layer.name !== "pois"; // remove "pois" layer
			});
		}
	},{
		builtin: "deliver"
	}]
}
```

## Compression

Precompress tiles with brotli and gzip and deliver them to capable clients.
Use with compressible tiles (vectortiles, json, svg) and not raster tiles.

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}.pbf",
	},{
		builtin: "compress",
		brotli: 6, // brotli compression level 6
		gzip: 4, // gzip compression level 4
	},{
		builtin: "deliver"
	}]
}
```

## Caching

``` js
{
	example: [{
		builtin: "parse",
	},{
		builtin: "cache", // before tile retrieved: check if tile is in cache
		skipto: "deliver", // skip to this builtin/plugin at cache hit
	},{
		// get tile from tileserver
		builtin: "tileserver",
		url: "https://tileserver.example/{z}/{x}/{y}",
	},{
		builtin: "cache", // after tile retrieved: store tile in cache
		expires: "30d", // keep in cache for 30 days
	},{
		builtin: "deliver",
	}]
}
```

## CORS

Allow Cross-origin resource sharing for certain domains

``` js
{
	builtin: "cors",
	origins: [ "https://example.org/" ], // "*" for any domain
}
```

