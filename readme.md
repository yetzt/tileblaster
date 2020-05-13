# tileblaster

tileblaster is a map tile caching (and optimizing) proxy, designed to run with nginx.

## install

`npm i tileblaster -g`

use `--no-optional` if you don't want tile optimization.

## run

`tileblaster /path/to/config.js`

Use [forever](https://npmjs.com/package/forever), [pm2](https://npmjs.com/package/pm2) or similar to run tileblaster as service;

## configuration

see [config.js.dist](config.js.dist)

### nginx configuration

```
upstream upstream_tileblaster {
	server unix:/path/to/tileblaster.sock;
}

server {
	listen 80;
	server_name tileblaster;

	location / {
		root /path/to/tileblaster/tiles;
		try_files $uri $uri/ @tileblaster;
	}

	location @tileblaster {
		proxy_pass http://upstream_tileblaster;
	}
}
```

## usage

get the tiles via `http://server/<mapid>/<z>/<x>/<y>[<d>].<ext>`
	
* `<mapid>` is the map id specified in your `config.js`
* `<z>`, `<x>` and `<z>` are the tile coorinates
* `<d>` is the optional pixel density marker, for example `@2x`
* `<ext>` is the extension, for example `png`, `geojson` or `mvt`
