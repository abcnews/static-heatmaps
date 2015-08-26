var Canvas, Image, request, simpleHeat, Promise, cache;

Canvas = require('canvas');
Image = Canvas.Image;
simpleHeat = require('./simpleheat');
request = require('request');
Promise = require('promise');
SphericalMercator = require('sphericalmercator');

cache = {};

module.exports = function() {
	var map, sm,
	 	coordinates, size, mapid, token, alpha, radius, bounds;

	map = {};
	radius = [6,12];

	map.coordinates = function(_) {
		if (!arguments.length) return coordinates.slice();
		coordinates = _.map(Number);
		return map;
	};

	map.size = function(_) {
		if (!arguments.length) return size.slice();
		size = _.map(Number).map(Math.round);
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
		sm = new SphericalMercator();
		getMapCanvas(function(err, img){
			if (err) {
				cb(err);
			} else {
				addOverlay(img,data,cb);
			}
		});
	};

	return map;

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

		canvas = new Canvas(size[0], size[1]);
		weight = 1 / Math.pow(2, Math.max(0, Math.min(18 - coordinates[2], 12)));
		centre = centre = sm.px([coordinates[1],coordinates[0]],coordinates[2]);


		ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);

		heatCanvas = new Canvas(size[0], size[1]);
		heatCtx = heatCanvas.getContext('2d');
		heat = simpleHeat(heatCanvas);

		xys = data.map(function(d){
			var center, origin, point;
			return sm.px([d[1],d[0]],coordinates[2]);
		}).filter(function(d){
			return true;
			// return inPxBounds(d, bounds);
		}).map(function(d){
			var origin;
			origin = [centre[0]-size[0]/2,centre[1]-size[1]/2];
			return [d[0]-origin[0],d[1]-origin[1]];
		}).reduce(function(t, d){
			var ref = d.join('x');
			lookup = lookup || {};
			if (!lookup[ref]) {
				lookup[ref] = d.concat([weight]);
				t.push(lookup[ref]);
			} else {
				lookup[ref][2] += weight;
			}
			return t;
		}, []);


		heat.data(xys);
		heat.radius(radius[0], radius[1]);
		heat.draw();

		ctx.globalAlpha = alpha;
		ctx.drawImage(heatCanvas, 0, 0);

		cb(null, canvas);
	}
};


// A really cheap and dirty string templating function.
function strReplace(str, replacements) {
	var key;
	for (key in replacements) {
		str = str.replace('{'+key+'}',replacements[key]);
	}
	return str;
}
