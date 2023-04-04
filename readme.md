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

## Usage

`tileblaster [options] [-c] config.js`

### Options

* `-c` `--config <config.js>` - load config file
* `-p` `--port <[host:]port>` - listen on this port (overrides config)
* `-s` `--socket <socket[,mode,gid]>` -  on this socket (overrides config)
* `-t` `--threads <num>` - number of threads (overrides config)
* `-h` `--help` - print help screen
* `-v` `--verbose` - enable debug output
* `-q` `--quiet` - disable debug output

## Configuration

See [config.md](./config.md)

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
