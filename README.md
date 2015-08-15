# Static heat
A simple static heatmap generator for Node JS and Mapbox.

## Usage
To use this you'll need an account at [Mapbox](https://www.mapbox.com/). Then, start by installing this library `npm i static-heatmaps`.

```
// Requirements
var fs = require('fs');
var map = require('static-heatmaps');

// Create, configure and render the map.
map.coordinates([-33.835809,151.242771,12])
    .size([700, 500])
    .mapid('a mapbox map style id')
    .token('your mapbox api token')
    .alpha(0.7);
    .render(saveMap);

// You can do whatever you want with the canvas object here, but here's an
// example showing how to save it to disk.
function saveMap(err, canvas) {

    var out = fs.createWriteStream(__dirname + '/heatmap.png');
    var stream = canvas.pngStream();

    stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        console.log('Done');
    });
}
```
