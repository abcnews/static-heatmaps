var Canvas, Image, request, simpleHeat, Promise;

Canvas = require('canvas');
Image = Canvas.Image;
simpleHeat = require('./simpleheat');
request = require('request');
Promise = require('promise');
SphericalMercator = require('sphericalmercator');

// Some things which can be shared between instances.
sm = new SphericalMercator();
cache = {};

module.exports = function() {
	var map, coordinates, size, mapid, token, alpha, radius, bounds;

	map = {};
	radius = [6,12];
	size = [400,400];
	coordinates = [0,0,0];
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
		// console.log([sm.ll(nwpx,zoom).reverse(),sm.ll(sepx,zoom).reverse()]);
		return [sm.ll(nwpx,zoom).reverse(),sm.ll(sepx,zoom).reverse()];
	}

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

		// Merge heat canvas with main canvas
		ctx.globalAlpha = alpha;
		ctx.drawImage(heatCanvas, 0, 0);

		// Callback
		cb(null, canvas);
	}


	function transform(data){
		var out, weight,
			zoom, centre, origin, bounds,
			r, max, maxZoom, v, cellSize, grid, panePos, offsetX, offsetY,
			i, len, p, cell, x, y, j, len2, k;

		// The result
		out = [];

		// The total radius for each heat spot
		r = radius[0]+radius[1];

		// The zoom level of the current map
		zoom = coordinates[2];

		// The centre point of the map in pixels
		centre = sm.px([coordinates[1],coordinates[0]], zoom);

		// The [0,0] (top left) coordinates of the requested map in pixels of the total world
		origin = [centre[0]-size[0]/2, centre[1]-size[1]/2];

		// The lat/lon bounds of the output image + heat radius
		bounds = {
			ne: sm.ll([centre[0]+size[0]/2+r,centre[1]-size[1]/2-r],zoom).reverse(),
			sw: sm.ll([centre[0]-size[0]/2-r,centre[1]+size[1]/2+r],zoom).reverse()
		};

		max = 1;
		maxZoom = 18;
		weight = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - zoom, 12)));

		console.log(maxZoom, zoom, weight);

		// weight=1;

		cellSize = r/2;
		grid = [];
		panePos = {x:0,y:0};
		offsetX = panePos.x % cellSize;
		offsetY = panePos.y % cellSize;

		grid = data.filter(function(ll){
			return inBounds(ll,bounds);
		}).reduce(function(grid, ll){
			var globalPosition, localPosition, ref, weight;

			globalPosition = sm.px([ll[1],ll[0]],zoom);

			localPosition = {};
			localPosition.x = globalPosition[0]-origin[0];
			localPosition.y = globalPosition[1]-origin[1];

			ref = {};
			ref.x = Math.floor((localPosition.x - offsetX) / cellSize) + 2;
			ref.y = Math.floor((localPosition.y - offsetY) / cellSize) + 2;

			grid[ref.y] = grid[ref.y] || [];
			cell = grid[ref.y][ref.x];

			if (cell) {
				// Reposition the center of this point within the grid.
				cell[0] = (cell[0] * cell[2] + localPosition.x * weight) / (cell[2] + weight); // x
				cell[1] = (cell[1] * cell[2] + localPosition.y * weight) / (cell[2] + weight); // y

				// Add to the accumulated intensity
				cell[2] += weight;
			} else {
				grid[ref.y][ref.x] = [localPosition.x, localPosition.y, weight];
			}

			return grid;

		}, []);

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
