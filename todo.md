# Todo

## Roadmap

* [x] Config format
	* [x] Map format
		* [-] Tasks fomat (WIP)
* [x] HTTP Server, Port and Socket
	* [ ] Graceful shutdown
* [-] Debug Library → `lib/debug.js` WIP
* [x] Optional Module Loader → `lib/load.js`
* [x] HTTPs Abstraction (~got or~ phin) → `lib/retrieve.js`
* [-] Plugin Interface
* [x] Plugin/Task Runner
* [ ] Plugins
	* [ ] Vectortiles Editor → https://www.npmjs.com/package/vtt
	* [ ] Resize and Convert Raster Tiles → https://www.npmjs.com/package/sharp
	* [ ] Convert Geojson ↔ Topojson
	* [ ] Convert Raster Formats (png,jpeg → webp,avif)
	* [ ] Redirects
	* [ ] GDAL?
* [ ] Builtins
	* [x] Compression → `builtin/compress.js`
	* [ ] Caching to Disk
	* [ ] Memcache → https://www.npmjs.com/package/iomem
* [ ] Tile Backends
	* [x] ZXY Webtiles → `builtin/tileserver.js`
	* [x] TMS Webtiles → `builtin/tileserver.js`
	* [ ] Versatiles
	* [ ] PMTiles
	* [ ] MBTiles?
	* [ ] WMS?
	* [ ] From tile.json → Expand jobs with .push()
* [ ] Cache Cleaning Worker
* [ ] Monitoring
* [ ] Map Web Interface
* [ ] Config Web Interface
* [ ] Documentation
	* [ ] What is Tileblaster, what is the benefit for the user
	* [ ] What can't tileblaster do
	* [ ] How to use it, Standalone or behind Proxy
	* [ ] Core concepts explained (maps, work queue, builtins and plugins)
	* [ ] All config options
	* [ ] All builtins
	* [ ] Example setups
* [ ] CLI
	* [-] Dev Server
	* [-] Cluster Support
	* [ ] Nodemon / PM2 Integration
	* [ ] Standalone Daemon with pid files?
* [ ] Support for Glyphs and Styles, tile.json proxy
* [ ] Request Queue to throttle unfulfilled requests
* [x] Custom String Template function for {x} replacement instead of regex
* [ ] Error wrapper (to pass along http status etc)

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

