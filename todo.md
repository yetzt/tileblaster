# Todo

## Roadmap

### 1.0 Release

* [x] Config format
	* [x] Map format
	* [x] Tasks fomat
* [x] HTTP Server, Port and Socket
	* [x] Graceful shutdown
* [x] Debug Library → `lib/debug.js`
* [x] Optional Module Loader → `lib/load.js`
* [x] HTTPs Abstraction (~got or~ phin) → `lib/retrieve.js`
* [x] Plugin Interface
* [x] Plugin/Task Runner
* [ ] Plugins
	* [ ] Nginx Cache Hydration
	* [ ] Vectortiles Editor → https://www.npmjs.com/package/vtt
	* [ ] Resize and Convert Raster Tiles → https://www.npmjs.com/package/sharp
	* [ ] Memcache → https://www.npmjs.com/package/iomem
	* [ ] Convert Geojson ↔ Topojson
	* [ ] Redirects
	* [ ] GDAL?
	* [ ] Render Tiles with MapLibreGL-Native
* [-] Builtins
	* [x] CORS
	* [x] Parse Request
	* [x] Check Request
	* [x] Tile Backends
		* [x] ZXY Webtiles → `builtin/tileserver.js`
		* [x] TMS Webtiles → `builtin/tileserver.js`
		* [x] Versatiles
		* [ ] PMTiles?
		* [ ] MBTiles?
		* [ ] WMS?
		* [ ] From tile.json → Expand jobs with .push()?
	* [x] Compression → `builtin/compress.js`
	* [x] Optimization (optipng, mozjpeg, svgo?, pbfcrop?)
	* [x] Modernize Raster Formats (png,jpeg → webp,avif)
	* [x] Caching to Disk
		* [x] Reading cached tile from Disk
		* [x] Skipping Jobs
		* [x] Etag Headers
		* [x] Last-Modified Headers
		* [x] Don't store if expired
		* [x] Expires Headers
		* [x] Don't update if already cached (in case of store-only)
		* [x] ~Cache-Control Headers~ → Set via `deliver` builtin
		* [ ] ~Store in MBTiles or similar?~ → Not now
	* [x] Delivery
	* [x] Debug Dump
* [x] Cache Cleaning Worker
* [ ] Documentation
	* [ ] What is Tileblaster, what is the benefit for the user
	* [ ] What can't tileblaster do
	* [ ] How to use it, Standalone or behind Proxy
	* [ ] Core concepts explained (maps, work queue, builtins and plugins)
	* [ ] All config options
	* [ ] All builtins
	* [ ] Example setups
	* [ ] Example Config
	* [ ] Example Nginx Config
* [x] CLI
	* [x] Cluster Support
	* [x] PM2 Integration
	* [x] Rudimentary Dev Server
	* [ ] ~Standalone Daemon with pid files?~
* [x] Request Queue to throttle unfulfilled requests

### Later

* [ ] Monitoring
* [ ] Map Web Interface
* [ ] Config Web Interface
* [ ] Support for Glyphs and Styles, tile.json proxy
* [x] Custom String Template function for {x} replacement instead of regex
* [ ] Error wrapper (to pass along http status etc)?
* [ ] Footprint
	* [ ] Replace Phin?

## Notes

* [x] treat density as int? → provide int in `params`
* [ ] differentiate between user errors and backend errors → error wrapper
* [x] audit plugins an builtins when reading config
* [x] sort out fix base / root / tiles; default to localhost and / config
* [ ] cache errors and empty tiles as well
* [x] pool http requests with agent
* [ ] figure out nginx hack for empty tiles and errors
* [ ] memcached nginx sample config
* [ ] figure out graceful reload / restart, signal handling
* [-] make logging and output consistant
* [x] allow bounds to span antimeridian
* [ ] ensure all tiles in tilestack are unique
* [ ] hydrate nginx cache directly

## Format Support

* [ ] Vector
	* [ ] mvt/pbf
	* [ ] svg
* [ ] Raster
	* [ ] png
	* [ ] jpeg
	* [ ] webp
	* [ ] avif
	* [ ] geotif (readonly)
* [ ] Data
	* [ ] GeoJSON
	* [ ] TopoJSON
	* [ ] JSON
	* [ ] ArcJSON?
	* [ ] WKT? → https://en.wikipedia.org/w/index.php?title=Well-known_text_representation_of_geometry

## Conversions

* [ ] GeoJSON ↔ TopoJSON
* [ ] WKT → GeoJSON  TopoJSON
* [ ] GeoJSON TopoJSON → SVG
* [ ] PNG JPEG WEBP AVIF TIF SVG → PNG JPEG WEBP AVIF
* [ ] MVT → SVG
* [ ] MVT → GeoJSON TopoJSON

## Etag

``` js
// nginx etag — for consistency
etag = util.format('"%s-%s"', Math.floor(mtimeMs/1000).toString(16), filesize.toString(16));
```
# Drafts

## What you can do with tileblaster

* You need a tileserver, but you don't want to operate a tileserver
* You use someone elses tileserver, but you don't want to cause traffic
* Your tileserver is weird and needs something the client can't do
* Your tileserver is slow and you need to speed things up by caching
* Your tileserver does not deliver the best formats for your browser
* Your tileserver delivers huge tiles
* You need to "fix it in post"

### What you can't do with tileblaster

* Render tiles from scratch

