
class WorleyNoise {

    constructor (point_count, r, n, width, height) {
        this.n = n;
        this.points = [ ];
        for (let i = 0; i < point_count; i++) {
            let angle = Math.random() * Math.PI * 2;
            this.points.push({ x:(Math.random() * 2 - 1) * Math.cos(angle) * r + (width / 2),
                               y:(Math.random() * 2 - 1) * Math.sin(angle) * r + (height / 2) });
        }
    }

    value(x, y) {
        let closest = new Array(this.n).fill(-666);
        for (let i = 0; i < this.points.length; i++) {
            let x_part = this.points[i].x - x;
            let y_part = this.points[i].y - y;
            let distance = Math.sqrt(x_part * x_part + y_part * y_part);
            if (distance < closest[0] || closest[0] < 0) {
                let storage = distance;
                for (let j = 0; j < this.n; j++) {
                    let new_storage = closest[j];
                    closest[j] = storage;
                    storage = new_storage;
                }
            }
        }
        return closest[this.n - 1];
    }
}

function worleyNoise(pointer, width, height) {
    let noise = new WorleyNoise(500, 200, 1, width, height);

    const max_distance = Math.sqrt(width * height) * 0.1;
    const body_color = { r:50, g:50, b:0 };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            let closest = noise.value(x, y);

            let light = 255 - Math.min(255, Math.floor((closest / max_distance) * 255));
            var scaler = Math.sin(light / 255);
            var out_color = { r:0, g:0, b:0 };
            out_color.r = scaler * body_color.r;
            out_color.g = scaler * body_color.g;
            out_color.b = scaler * body_color.b;
            out_color.r += light - (1 - scaler) * 255;
            out_color.g += light - (1 - scaler) * 255;
            out_color.b += light - (1 - scaler) * 255;

            let index = (y * width + x) * 4;
            pointer[index]     = Math.floor(out_color.r);
            pointer[index + 1] = Math.floor(out_color.g);
            pointer[index + 2] = Math.floor(out_color.b);
            pointer[index + 3] = 255;
        }
    }
}

function generateDemon(ctx, width, height) {
    ctx.fillStyle = "#CC1256";
    let w2 = width / 2;
    let h2 = height / 2;
    ctx.beginPath();
    ctx.arc(w2, h2, h2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#EEEEEE";
    ctx.beginPath();
    ctx.arc(w2 - (w2 / 2), h2 - (h2 / 4), h2 / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#EEEEEE";
    ctx.beginPath();
    ctx.arc(w2 + (w2 / 2), h2 - (h2 / 4), h2 / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(w2 - (w2 / 2), h2 - (h2 / 4), h2 / 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(w2 + (w2 / 2), h2 - (h2 / 4), h2 / 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(w2, h2 + (h2 / 3), h2 / 2, 0, Math.PI);
    ctx.fill();
}
