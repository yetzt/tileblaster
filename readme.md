# tileblaster

tileblaster is a map tile caching (and optimizing) proxy, designed to run with nginx.

## install

`npm i tileblaster -g`

use `--no-optional` if you don't need tile optimization and don't want to clutter your `node_modules` with tons of packages.

## configuration

see [config.js.dist](config.js.dist)

### nginx configuration

```
upstream tileblaster {
	server unix:/path/to/tileblaster.sock;
}

server {
	listen 80;
	server_name tileblaster;

	gzip off;
	gzip_static on;
	gunzip on;

	location / {
		root /path/to/tileblaster/tiles;
		if (!-f $request_filename.gz) {
			proxy_pass http://upstream_tileblaster;
		}
	}
}
```

using `if` because `try_files` doesn't play nice with `gzip_static` when no uncompressed file is around.

## usage

get the tiles via `http://server/<mapid>/<z>/<x>/<y>[<d>].<ext>`
	
* `<mapid>` is the map id specified in your `config.js`
* `<z>`, `<x>` and `<z>` are the tile coorinates
* `<d>` is the optional pixel density marker, for example `@2x`
* `<ext>` is the extension, for example `png`, `geojson` or `mvt`
