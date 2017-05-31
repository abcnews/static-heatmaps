// Example output

var fs = require('fs');
var map = require('./map');
var location = [-33.835809,151.242771];
// var data = range(50000, function(){
// 	return [location[0]+(Math.random()-0.5),location[1]+(Math.random()-0.5)];
// });
// fs.writeFile('./data.json',JSON.stringify(data), {encoding:'utf-8'});

data = require('./data.json');

// Create, configure and render the map.
range(10, function(i){
	return i+7;
}).forEach(function(zoom){
	map().coordinates(location.concat([zoom]))
	    .size([700, 500])
	    .mapid('mapbox.streets')
	    .token(process.env.MAPBOX_TOKEN)
	    .alpha(1)
	    .render(data, saveMap);

	// You can do whatever you want with the canvas object here, but here's an
	// example showing how to save it to disk.
	function saveMap(err, canvas) {

	    var out = fs.createWriteStream(__dirname + '/heatmap-'+zoom+'.png');
	    var stream = canvas.pngStream();

	    stream.on('data', function(chunk){
	        out.write(chunk);
	    });

	    stream.on('end', function(){
	        console.log('Done');
	    });
	}

});


function range(n, fn) {
	var i = -1, r = new Array(n);
	while (++i < n) r[i] = fn(i);
	return r;
}