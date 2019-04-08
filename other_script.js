let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let debug = document.getElementById("debuginfo");

const cv_width = canvas.width;
const cv_height = canvas.height;
const resolution = 512;

let surface = ctx.createImageData(resolution, resolution);
let surface_data = surface.data;

function main() {
    // worleyNoise(surface_data, resolution, resolution);
    // ctx.putImageData(surface, 0, 0);
    generateDemon(ctx, cv_width, cv_height);
}

main();
