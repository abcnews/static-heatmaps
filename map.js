var Canvas, Image, request, simpleHeat, Promise;

Canvas = require('canvas');
Image = Canvas.Image;
simpleHeat = require('./simpleheat');
request = require('request');
Promise = require('promise');

module.exports = function() {
	var map, cache,
	 	coordinates, size, mapid, token, alpha, radius;

	map = {};
	cache = {};
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

		var canvas, ctx, heatCanvas, heatCtx, heat;

		canvas = new Canvas(size[0], size[1]);
		ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);

		heatCanvas = new Canvas(size[0], size[1]);
		heatCtx = heatCanvas.getContext('2d');
		heat = simpleHeat(heatCanvas);
		data = data.map(function(d){
			var centre = latLngToPoint(coordinates[0],coordinates[1],coordinates[2]),
				origin = [centre[0]-size[0]/2,centre[1]-size[1]/2],
				point = latLngToPoint(d[0],d[1],coordinates[2]);
			return [point[0]-origin[0],point[1]-origin[1]];
		});

		heat.data(data);
		heat.radius(radius[0], radius[1]);
		heat.draw();

		ctx.globalAlpha = alpha;
		ctx.drawImage(heatCanvas, 0, 0);

		cb(null, canvas);
	}
};


function strReplace(str, replacements) {
	var key;
	for (key in replacements) {
		str = str.replace('{'+key+'}',replacements[key]);
	}
	return str;
}

function sphericalMercator(lat, lng) {
	var R = 6378137,
		d = Math.PI / 180,
	    max = 1 - 1E-15,
	    sin = Math.max(Math.min(Math.sin(lat * d), max), -max);

	return [R * lng * d, R * Math.log((1 + sin) / (1 - sin)) / 2];
}

function latLngToPoint(lat, lng, zoom) {
	var projected = sphericalMercator(lat, lng),
		scale = 256 * Math.pow(2, zoom);
	return transformation(projected, scale);
}

function transformation(point, scale) {
	var mercatorScale = 0.5 / (Math.PI * 6378137);
	point[0] = scale * (mercatorScale * point[0] + 0.5);
	point[1] = scale * (-mercatorScale * point[1] + 0.5);
	return point;
}
