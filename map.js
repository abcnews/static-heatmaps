var Canvas, Image, request, simpleHeat, Promise;

Canvas = require('canvas');
Image = Canvas.Image;
simpleHeat = require('./simpleheat');
request = require('request');
Promise = require('promise');
SphericalMercator = require('sphericalmercator');

module.exports = function() {
	var map, cache, sm,
	 	coordinates, size, mapid, token, alpha, radius, bounds;

	map = {};
	cache = {};
	radius = [6,12];
	size = [400,400];
	coordinates = [0,0,0];
	sm = new SphericalMercator();
	bounds = getBounds();

	map.coordinates = function(_) {
		if (!arguments.length) return coordinates.slice();
		coordinates = _.map(Number);
		bounds = getBounds();
		return map;
	};

	map.size = function(_) {
		if (!arguments.length) return size.slice();
		size = _.map(Number).map(Math.round);
		bounds = getBounds();
		return map;
	};

	map.radius = function(_) {
		if (!arguments.length) return radius.slice();
		radius = _;
		return map;
	};

	map.mapid = function(_) {
		if (!arguments.length) return mapid;
		mapid = _;
		return map;
	};

	map.token = function(_) {
		if (!arguments.length) return token;
		token = _;
		return map;
	};

	map.alpha = function(_) {
		if (!arguments.length) return alpha;
		alpha = _;
		return map;
	};

	map.render = function(data, cb) {
		getMapCanvas(function(err, img){
			if (err) {
				cb(err);
			} else {
				addOverlay(img,data,cb);
			}
		});
	};

	return map;

	function getBounds() {
		var centre, nwpx, sepx, zoom, r;
		zoom = coordinates[2];
		r = radius[0] + radius[1];
		centre = sm.px([coordinates[1],coordinates[2]], zoom);

		nwpx = [centre[0]-size[0]/2,centre[0]-size[1]/2];
		sepx = [centre[1]+size[1]/2,centre[1]+size[1]/2];
		console.log([sm.ll(nwpx,zoom).reverse(),sm.ll(sepx,zoom).reverse()]);
		return [sm.ll(nwpx,zoom).reverse(),sm.ll(sepx,zoom).reverse()];
	}

	// function pxBounds() {
	// 	var c, nw, se, buffer;
	// 	buffer = size[0]+size[1];
	// 	c = sm.px([coordinates[1],coordinates[0]],coordinates[2]);
	// 	return [[c[0]-size[0]/2-buffer,c[1]-size[1]/2-buffer],[c[0]+size[0]/2+buffer,c[1]+size[1]/2+buffer]];
	// }

	function getMapCanvas(cb){

		var url;

		url = strReplace('https://api.mapbox.com/v4/{mapid}/{lon},{lat},{z}/{width}x{height}.{format}?access_token={token}', {
			mapid: mapid,
			lat: coordinates[0],
			lon: coordinates[1],
			z: coordinates[2] || 19,
			width: size[0],
			height: size[1],
			format: 'png',
			token: token
		});

		cache[url] = cache[url] || new Promise(function (resolve, reject) {
			request({
				url: url,
				encoding: null
			}, function (err, res, data) {

				var canvas, ctx, img;

				if (err) {
					reject(err);
				}

				img = new Image();
				img.src = data;

				resolve(img);
			});
		});

		cache[url].nodeify(cb);
	}

	function addOverlay(img, data, cb) {

		var canvas, ctx, heatCanvas, heatCtx, heat, xys, centre, lookup, weight;

		// Main canvas
		canvas = new Canvas(size[0], size[1]);
		ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);

		// Heat canvas
		heatCanvas = new Canvas(size[0], size[1]);
		heatCtx = heatCanvas.getContext('2d');
		heat = simpleHeat(heatCanvas);

		// Draw heat canvas
		heat.data(transform(data));
		heat.radius(radius[0], radius[1]);
		heat.draw();
		// transform(data);
		// Merge heat canvas with main canvas
		ctx.globalAlpha = alpha;
		ctx.drawImage(heatCanvas, 0, 0);

		// Callback
		cb(null, canvas);
	}

	function transform(data){
		var out,
			zoom, centre, origin, nw, se,
			r, bounds, max, maxZoom, v, cellSize, grid, panePos, offsetX, offsetY,
			i, len, p, cell, x, y, j, len2, k;

		out = [];
		r = radius[0]+radius[1];
		zoom = coordinates[2];
		centre = sm.px([coordinates[1],coordinates[0]], zoom);
		origin = [centre[0]-size[0]/2, centre[1]-size[1]/2];
		sw = sm.ll([centre[0]-size[0]/2-r,centre[1]+size[1]/2+r],zoom).reverse();
		ne = sm.ll([centre[0]+size[0]/2+r,centre[1]-size[1]/2-r],zoom).reverse();
		bounds = {ne:ne, sw:sw};
		max = 1;
		maxZoom = 18;
		v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - zoom, 12)));
		cellSize = r/2;
		grid = [];
		panePos = {x:0,y:0};
		offsetX = panePos.x % cellSize;
		offsetY = panePos.y % cellSize;

		// console.log(r, size, bounds, max, maxZoom, v, cellSize, grid, panePos, offsetX, offsetY);
		var cnt = 0;
		// console.time('process');
		for (i = 0, len = data.length; i < len; i++) {
			if (inBounds(data[i], bounds)) {
				cnt++;
				p = sm.px([data[i][1],data[i][0]],zoom);
				p = {x: p[0]-origin[0], y: p[1]-origin[1]};
				x = Math.floor((p.x - offsetX) / cellSize) + 2;
				y = Math.floor((p.y - offsetY) / cellSize) + 2;

				var alt = 1;
				k = alt * v;

				grid[y] = grid[y] || [];
				cell = grid[y][x];

				if (!cell) {
					grid[y][x] = [p.x, p.y, k];

				} else {
					cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k); // x
					cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k); // y
					cell[2] += k; // cumulated intensity value
				}
			}
		}

		for (i = 0, len = grid.length; i < len; i++) {
			if (grid[i]) {
				for (j = 0, len2 = grid[i].length; j < len2; j++) {
					cell = grid[i][j];
					if (cell) {
						out.push([
							Math.round(cell[0]),
							Math.round(cell[1]),
							Math.min(cell[2], max)
						]);
					}
				}
			}
		}

		return out;

	}

	function inBounds(ll, bounds) {

		// Outside latitude?
		if (ll[0] > bounds.ne[0] || ll[0] < bounds.sw[0]) {
			return false;
		}

		// Outside longitude & no date-line cross
		if (bounds.ne[1] >= bounds.sw[1] && (ll[1] > bounds.ne[1] || ll[1] < bounds.sw[1])) {
			return false;
		}

		// Outside longitude with dateline cross
		if (bounds.ne[1] < bounds.sw[1] && (ll[1] <= bounds.ne[1] || ll[1] >= bounds.sw[1])) {
			return false;
		}

		return true;
	}
};

function inPxBounds(xy, bbox) {
	return xy[0] >= bbox[0][0] && xy[0] <= bbox[1][0] && xy[1] >= bbox[0][1] && xy[1] <= bbox[1][1];
}

function inBounds(ll, bbox) {
	// console.log(ll,bbox);
	return ll[0] >= bbox[0][0] &&
		ll[0] <= bbox[1][0] &&
		ll[1]+180 >= bbox[0][1]+180 &&
		ll[1]+180 <= bbox[1][1]+180;
}


// A really cheap and dirty string templating funciton.
function strReplace(str, replacements) {
	var key;
	for (key in replacements) {
		str = str.replace('{'+key+'}',replacements[key]);
	}
	return str;
}
