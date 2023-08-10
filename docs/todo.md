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
* [x] Plugin Interface / Task Runner
* [x] Builtins
	* [x] CORS
	* [x] Parse Request
	* [x] Check Request
	* [x] Tile Backends
		* [x] ZXY Webtiles → `builtin/tileserver.js`
		* [x] TMS Webtiles → `builtin/tileserver.js`
		* [x] Versatiles
		* [x] PMTiles
		* [x] MBTiles
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
	* [x] Delivery
	* [x] Debug Dump
	* [x] Vectortile Editing
	* [x] Full image manipulation for raster tiles → https://www.npmjs.com/package/sharp
	* [x] Vectortiles Editor → https://www.npmjs.com/package/vtt
* [x] Cache Cleaning Worker
* [x] Documentation
	* [x] What is Tileblaster, what is the benefit for the user
	* [x] What can't tileblaster do
	* [x] All config options
	* [x] All builtins
	* [x] Example Config
	* [x] Example Nginx Config
	* [x] How to use it, Standalone or behind Proxy
	* [x] Core concepts explained (maps, work queue, builtins and plugins)
	* [x] Examples
		* [x] Caching proxy for a tileserver
		* [x] Serve tiles from container
		* [x] Raster editing: "Dark mode"
		* [x] Vector editing: remove unused layers
	* How to contribute, bug reports
* [x] CLI
	* [x] Cluster Support
	* [x] PM2 Integration
	* [x] Rudimentary Dev Server
* [x] Request Queue to throttle unfulfilled requests
* [x] Fancy Default Page
* [x] Custom String Template function for {x} replacement instead of regex

### Next

* [ ] Redirects
* [ ] Convert Geojson ↔ Topojson
* [ ] Map Web Interface, Configurable
* [ ] Configurable Index Page
* [ ] Support for Glyphs and Styles, tile.json proxy
* [x] Better Error Handling
	* [x] Error wrapper (to pass along http status etc)?
	* [x] Skip for nonexistant tiles
* [ ] Render Vector Tiles with MapLibreGL-Native
* [ ] Improve Debug Consistency
* [ ] Documentation: How to write a plugin

### Later

* [ ] Screencast
* [ ] Monitoring / Status / Statistics Interface
* [ ] Integration with Nginx-Cache
* [ ] Memcache → https://www.npmjs.com/package/iomem
* [ ] Backends
	[ ] tilebase https://www.npmjs.com/package/tilebase
	[ ] Geotiff?
	[ ] PostGIS database via ST_AsMVT?
* [ ] Conversions
	* [ ] pbf → svg
	* [ ] svg → raster
	* [ ] geotif → raster

### Probably Never

* [ ] v0 Config Migration?
* [ ] use mbtiles database as cache?
* [ ] Standalone Logging?
* [ ] Config Web Interface
* [ ] Standalone Daemon with pid files?
* [ ] Cache: Store in MBTiles or similar?
* [ ] GDAL?
* [ ] Footprint
	* [ ] Replace Phin?
* [ ] ~Nginx Cache Hydration~ (Problem: different file owners)

## Format Support

* [x] Vector
	* [x] mvt/pbf
	* [ ] svg
* [x] Raster
	* [x] png
	* [x] jpeg
	* [x] webp
	* [x] avif
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
