/*
 (c) 2014, Vladimir Agafonkin
 simpleheat, a tiny JavaScript library for drawing heatmaps with Canvas
 https://github.com/mourner/simpleheat

 Copyright (c) 2014, Vladimir Agafonkin
 All rights reserved.

 Redistribution and use in source and binary forms, with or without modification, are
 permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice, this list of
       conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright notice, this list
       of conditions and the following disclaimer in the documentation and/or other materials
       provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
 Modified by Simon Elvery <simon@elvry.net> to support Node.js and use of node-canvas
*/

Canvas = require('canvas');

module.exports = simpleheat;

function simpleheat(canvas) {
    // jshint newcap: false, validthis: true
    if (!(this instanceof simpleheat)) { return new simpleheat(canvas); }

    this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

    this._ctx = canvas.getContext('2d');
    this._width = canvas.width;
    this._height = canvas.height;

    this._max = 1;
    this.clear();
}

simpleheat.prototype = {

    defaultRadius: 25,
    defaultGradient: {0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1: 'red'},

    data: function (data, max) {
        this._data = data;
        return this;
    },

    max: function (max) {
        this._max = max;
        return this;
    },

    add: function (point) {
        this._data.push(point);
        return this;
    },

    clear: function () {
        this._data = [];
        return this;
    },

    radius: function (r, blur) {
        blur = blur || 15;

        var circle = this._circle = new Canvas(),
            ctx = circle.getContext('2d'),
            r2 = this._r = r + blur;

        circle.width = circle.height = r2 * 2;

        ctx.shadowOffsetX = ctx.shadowOffsetY = 200;
        ctx.shadowBlur = blur;
        ctx.shadowColor = 'black';

        ctx.beginPath();
        ctx.arc(r2 - 200, r2 - 200, r, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        return this;
    },

    gradient: function (grad) {
        var canvas = new Canvas(),
            ctx = canvas.getContext('2d'),
            gradient = ctx.createLinearGradient(0, 0, 0, 256);

        canvas.width = 1;
        canvas.height = 256;

        for (var i in grad) {
            gradient.addColorStop(+i, grad[i]);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        this._grad = ctx.getImageData(0, 0, 1, 256).data;

        return this;
    },

    draw: function (minOpacity) {
        if (!this._circle) {
            this.radius(this.defaultRadius);
        }
        if (!this._grad) {
            this.gradient(this.defaultGradient);
        }

        var ctx = this._ctx;

        ctx.clearRect(0, 0, this._width, this._height);

        for (var i = 0, len = this._data.length, p; i < len; i++) {
            p = this._data[i];

            ctx.globalAlpha = Math.max(p[2] / this._max, minOpacity || 0.05);
            ctx.drawImage(this._circle, p[0] - this._r, p[1] - this._r);
        }

        var colored = ctx.getImageData(0, 0, this._width, this._height);
        this._colorize(colored.data, this._grad);
        ctx.putImageData(colored, 0, 0);

        return this;
    },

    _colorize: function (pixels, gradient) {
        for (var i = 3, len = pixels.length, j; i < len; i += 4) {
            j = pixels[i] * 4;

            if (j) {
                pixels[i - 3] = gradient[j];
                pixels[i - 2] = gradient[j + 1];
                pixels[i - 1] = gradient[j + 2];
            }
        }
    }
};
