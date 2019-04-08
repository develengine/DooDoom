var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var debug = document.getElementById("debuginfo");
var fov_slider = document.getElementById("fov");

const cv_width = canvas.width;
const cv_height = canvas.height;

var images = { };
var to_load_images = [ "res/gunner.png" ];
var to_scan_images = [ { f:generateDemon, s:"demon" } ];

var loaded_imgs = 0;
function loadImages() {
    if (loaded_imgs < to_load_images.length) {
        var this_image = to_load_images[loaded_imgs];
        loaded_imgs++;
        var img = new Image();
        // img.setAttribute('crossOrigin', 'anonymous');
        images[this_image] = img;
        images[this_image].onload = loadImages;
        images[this_image].src = this_image;
    } else {
        main();
    }
}

var keys_states = { };
window.onkeyup = function(e) {
    keys_states[e.key] = false;
}
window.onkeydown = function(e) {
    keys_states[e.key] = true;
}


var surfaces = { };
function loadSurfaces() {
    for (var i = 0; i < to_scan_images.length; i++) {
        var img = to_scan_images[i];
        ctx.clearRect(0, 0, cv_width, cv_height);
        img.f(ctx, 256, 256);
        var surface = ctx.getImageData(0, 0, 256, 256);
        surfaces[img.s] = surface;
    }
}

function randRange(mn, mx) {
    return Math.floor((Math.random() * (mx - mn)) + mn);
}

var last_alt = true;
function playSound(sound, alter = false) {
    var alt = "";
    if (alter) {
        if (last_alt) { alt = 1; last_alt = false }
        else { alt = 2; last_alt = true }
    }
    var audio = new Audio("res/" + sound + alt + ".mp3");
    audio.play();
}


// ====================== //


var level = [
    "# ##############################",
    "         #              #       ",
    "#        #        ### ###       ",
    "#        #   c    #c#   #       ",
    "#     ####        #     # c     ",
    "#        #        #     #      c",
    "#   #             #     #### ###",
    "#                 #            c",
    "#    c   #   c    #             ",
    "##########      ###########     ",
    "#c              # c             ",
    "#        #      #               ",
    "#  ################  #########  ",
    "#  #ccc         #        #      ",
    "#  ############ #        #      ",
    "#     #         #  c     #      ",
    "#           #   #######  # c    ",
    "#           c#     #c    #      ",
    "#            c#    #     #     c",
    "###############   ###### #c     ",
    "# c                      #      "
];
var level_width  = level[0].length;
var level_height = level.length;

// Constants
const player_speed = 0.002;
const player_rot_speed = 0.0015;
const step_length = 0.95;
const player_full_hp = 20;
const player_collision_distance = 0.25;
const full_amunition = 7;
const gun_damage = 7;
const reload_time = 2500;
const map_scale = Math.ceil((cv_height / 100) * 2.5);
const map_enabled = false;

// Player variables
var player_rot   = Math.PI / 2;
var player_pos_x = 1.5;
var player_pos_y = 1.5;
var player_hp    = player_full_hp;

// Shooting global variables
var ammunition   = full_amunition;
var shooting  = false;
var can_shoot = true;
var reloading = false;
var reloading_time_left = 0;
var shooting_scaler = 1;

// Walking global variables
var walking = false;
var walked_distance = 0;

// Projection variables
var fov = (Math.PI / 180) * 70;
var screen_distance =  1 / Math.tan(fov / 2);
fov_slider.oninput = function() {
    fov = (Math.PI / 180) * this.value;
    screen_distance =  1 / Math.tan(fov / 2);
}

// Drawing buffer
var draw_surface = ctx.createImageData(cv_width, cv_height);
var surface_data = draw_surface.data;

// Frame snd timing variables
time_old = performance.now();
var frames_this_second  = 0;
var time_from_last_frame = 0;

// List of entities
var entities = [ ];

// ====================== //


class Entity {

    constructor(x, y, r, hp, image) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.hp = hp;
        this.full_hp = hp;
        this.image = image;
    }

    update(dt) { }
}

class Chicken extends Entity {

    constructor(x, y, hp) {
        super(x, y, 0.25, hp, "demon");
    }

    update(dt) {
        const chase_distance  = 20;
        const attack_distance = 1;
        const speed = 0.0015;

        var pos_x = player_pos_x - this.x;
        var pos_y = player_pos_y - this.y;
        var distance = Math.sqrt(pos_x * pos_x + pos_y * pos_y);
        if (distance > chase_distance) return;
        var norm_x = pos_x / distance;
        var norm_y = pos_y / distance;
        var ray_l = castRay(norm_x, norm_y, this.x, this.y);
        if (distance < ray_l && distance > attack_distance) {
            var velocity = clipMovement(norm_x * speed * dt, norm_y * speed * dt,
                                        this.x, this.y, this.r);
            this.x += velocity.x;
            this.y += velocity.y;
        } else if (distance < ray_l) {
            player_hp -= dt * 0.01;
        }
    }
}


// ====================== //

function parseMap(map, list) {
    for (var i = 0; i < map.length; i++) {
        for (var j = 0; j < map[i].length; j++) {
            if (map[i][j] == 'c')
                list.push(new Chicken(j + 0.5, i + 0.5, 30));
        }
    }
}

function loop() {
    requestAnimationFrame(loop);

    var delta_time = timing();

    if (player_hp > 0) {
        input(delta_time);
    }
    logic(delta_time);
    render(delta_time);

    if (player_hp <= 0) {
        ctx.font = (cv_height / 6).toString() + "px serif";
        ctx.fillStyle = "#FF0000";
        ctx.textAlign = "center";
        ctx.fillText("You Died", cv_width / 2, cv_height / 2);
    }

    if (entities.length == 0) {
        ctx.font = (cv_height / 6).toString() + "px serif";
        ctx.fillStyle = "#00FF00";
        ctx.textAlign = "center";
        ctx.fillText("You Won", cv_width / 2, cv_height / 2);
    }

}

function timing() {
    var timeNew = performance.now();
    var delta_time = (timeNew - time_old);
    time_old = timeNew;

    time_from_last_frame += delta_time;
    frames_this_second++;

    if (time_from_last_frame >= 1000) {
        var lol = Math.floor(time_from_last_frame / 1000);
        debug.textContent = "FPS: " + (frames_this_second / lol).toString();
        frames_this_second = 0;
        time_from_last_frame = time_from_last_frame % 1000;
    }
    return delta_time;
}

function logic(dt) {
    // Updating all entities
    for (var i = 0; i < entities.length; i++) {
        entities[i].update(dt);
    }
    // Reloading logic
    if (reloading 
    && performance.now() - reloading_time_left > reload_time) {
        reloading = false;
        ammunition = full_amunition;
    }
    // Walking logic
    if (walked_distance > step_length && walking) {
        playSound("step", true);
        walked_distance -= step_length;
    }
    // Shooting logic
    if (shooting && can_shoot) {
        var shortest_distance = 666;
        var closest_entity = -666;
        var vx = Math.cos(player_rot);
        var vy = Math.sin(player_rot);
        var ray_length = castRay(vx, vy, player_pos_x, player_pos_y);
        for (var i = 0; i < entities.length; i++) {
            var t_x = entities[i].x - player_pos_x;
            var t_y = entities[i].y - player_pos_y;
            var r_x = Math.cos(-player_rot) * t_x - Math.sin(-player_rot) * t_y;
            var r_y = Math.cos(-player_rot) * t_y + Math.sin(-player_rot) * t_x;
            if (Math.abs(r_y) < entities[i].r && r_x > 0) {
                var ent_distance = r_x - Math.sqrt(entities[i].r * entities[i].r - r_y * r_y);
                if (ent_distance  < ray_length && ent_distance < shortest_distance) {
                    shortest_distance = ent_distance;
                    closest_entity = i;
                }
            }
        }
        can_shoot = false;
         if (ammunition > 0) {
            ammunition--;
            shooting_scaler = 2;
            playSound("shot");
            if (closest_entity > -1) {
                entities[closest_entity].hp -= gun_damage;
                if (entities[closest_entity].hp <= 0)
                    entities.splice(closest_entity, 1);
            }
        } else playSound("click");
    }
}

function castRay(vx, vy, px, py) {
    var x_s = vx < 0;
    var y_s = vy < 0;
    var int_x = (x_s ? Math.floor(px) : Math.ceil(px));
    var int_y = (y_s ? Math.floor(py) : Math.ceil(py));

    while (true) {
        var x_rat = (x_s ? Math.abs(vx / (px - int_x)) : Math.abs(vx / (int_x - px)));
        var y_rat = (y_s ? Math.abs(vy / (py - int_y)) : Math.abs(vy / (int_y - py)));
        if (x_rat > y_rat) {
            var y = (y_s ? int_y : int_y - 1); // WARNING: y can overshoot the array
            var x = (x_s ? int_x - 1 : int_x);
            if (x < 0 || x >= level_width || level[y][x] == '#') {
                return 1 / x_rat;
            } else int_x = (x_s ? int_x - 1 : int_x + 1);
        } else {
            var x = (x_s ? int_x : int_x - 1); // WARNING: x can overshoot the array
            var y = (y_s ? int_y - 1 : int_y);
            if (y < 0 || y >= level_height || level[y][x] == '#') {
                return 1 / y_rat;
            } else int_y = (y_s ? int_y - 1 : int_y + 1);
        }
    }
}

function clipMovement(vx, vy, px, py, cd = player_collision_distance) {
    var int_ax = Math.floor(px);
    var int_bx = Math.floor(px + (vx < 0 ? vx - cd : vx + cd));
    var int_ay = Math.floor(py);
    var int_by = Math.floor(py + (vy < 0 ? vy - cd : vy + cd));
    var output = { "x": 0, "y": 0 };
    if (int_ax != int_bx && (int_bx < 0 || int_bx >= level_width || level[int_ay][int_bx] == '#')) {
        output.x = (vx < 0 ? -(px - int_ax - cd) : Math.ceil(px) - px - cd);
    } else output.x = vx;
    var new_int_x = Math.floor(px + output.x);
    if (int_ay != int_by && (int_by < 0 || int_by >= level_height || level[int_by][new_int_x] == '#')) {
        output.y = (vy < 0 ? -(py - int_ay - cd) : Math.ceil(py) - py - cd);
    } else output.y = vy;
    return output;
}

function input(dt) {
    
    if (keys_states['ArrowRight']) {
        player_rot += player_rot_speed * dt;
    }
    if (keys_states['ArrowLeft']) {
        player_rot -= player_rot_speed * dt;
    }

    walking = false;
    var walking_check = 0;

    var sin_vel = Math.sin(player_rot) * player_speed * dt;
    var cos_vel = Math.cos(player_rot) * player_speed * dt;
    var x_vel = 0;
    var y_vel = 0;

    if (keys_states['d']) {
        walking_check += 1;
        x_vel -= sin_vel;
        y_vel += cos_vel;
    }
    if (keys_states['a']) {
        walking_check -= 1;
        x_vel += sin_vel;
        y_vel -= cos_vel;
    }
    if (keys_states['w']) {
        walking_check += 2;
        x_vel += cos_vel;
        y_vel += sin_vel;
    }
    if (keys_states['s']) {
        walking_check -= 2;
        x_vel -= cos_vel;
        y_vel -= sin_vel;
    }
    var velocity = clipMovement(x_vel, y_vel, player_pos_x, player_pos_y);
    player_pos_x += velocity.x;
    player_pos_y += velocity.y;
    walked_distance += Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (walking_check != 0) walking = true;

    if (!reloading && keys_states['r']) {
        reloading = true;
        reloading_time_left = performance.now();
        playSound("reload");
    }

    if (!reloading) {
        if (keys_states[' ']) shooting = true;
        else { shooting = false; can_shoot = true; }
    }
}

function render(dt) {
    // Wall rendering and filling depth_buffer
    var depth_buffer = [ ];

    var  row_increment = fov / cv_width;
    for (var x = 0; x < cv_width; x++) {
        var rotation = player_rot - (fov / 2) + row_increment * x;
        var vx = Math.cos(rotation);
        var vy = Math.sin(rotation);
        var length = castRay(vx, vy, player_pos_x, player_pos_y);
        depth_buffer.push(length);
        var wall_scale = (1 - Math.min(1, (screen_distance / length)));
        var wall_size = Math.ceil(wall_scale * (cv_height / 2));
        const shade = Math.floor((1 - wall_scale) * 255);

        for (var y = 0; y < wall_size; y++) {
            var p = ((y * cv_width) + x) * 4;
            surface_data[p]     = 0;
            surface_data[p + 1] = 0;
            surface_data[p + 2] = 0;
            surface_data[p + 3] = 255;
        }
        for (var y = wall_size; y < cv_height - wall_size; y++) {
            var p = ((y * cv_width) + x) * 4;
            surface_data[p]     = shade;
            surface_data[p + 1] = shade;
            surface_data[p + 2] = shade;
            surface_data[p + 3] = 255;
        }
        for (var y = cv_height - wall_size; y < cv_height; y++) {
            var p = ((y * cv_width) + x) * 4;
            const light = 15;
            surface_data[p]     = light;
            surface_data[p + 1] = light;
            surface_data[p + 2] = light;
            surface_data[p + 3] = 255;
        }
    }

    // Drawing entities and filling health_bars
    var health_bars = [ ];

    entities.sort(function(a, b) {
        var ax = player_pos_x - a.x;
        var ay = player_pos_y - a.y;
        var bx = player_pos_x - b.x;
        var by = player_pos_y - b.y;
        return Math.sqrt(bx * bx + by* by) - Math.sqrt(ax * ax + ay* ay);
    });

    for (var i = 0; i < entities.length; i++) {
        var t_pos_x = entities[i].x - player_pos_x;
        var t_pos_y = entities[i].y - player_pos_y;
        var r_pos_x = (Math.cos(-player_rot) * t_pos_x) - (Math.sin(-player_rot) * t_pos_y);
        var r_pos_y = (Math.cos(-player_rot) * t_pos_y) + (Math.sin(-player_rot) * t_pos_x);
        if (r_pos_x < 0) continue;
        var p_pos_y = ((r_pos_y / (Math.tan((fov) / 2) * r_pos_x)) * (cv_width / 2)) + (cv_width / 2);
        var p_pos_x = Math.sqrt(r_pos_x * r_pos_x + r_pos_y * r_pos_y);
        var int_x   = Math.floor(p_pos_y);

        var entity_scale = (1 - Math.min(1, (screen_distance / p_pos_x)));
        var scale_ratio  = 1 + (screen_distance / p_pos_x) * (1 - 0.5);
        var entity_size  = Math.ceil(entity_scale * (cv_height / 2) * scale_ratio);
        var height_diff  = Math.ceil(entity_scale * (cv_height / 2)) - entity_size;

        var left_corner = int_x - Math.floor(cv_height / 2) + entity_size;
        var top_corner  = entity_size - height_diff;
        var ent_width   = cv_height - entity_size * 2;
        var ent_height  = -top_corner + cv_height - entity_size - height_diff;
        var ent_light   = 1 - entity_scale;

        health_bars.push({ "i": i, "x": int_x, "y": top_corner, "d":  p_pos_x});

        var clipped_x     = Math.max(0, left_corner);
        var sample_start  = Math.abs(Math.min(0, left_corner));
        var width_clipped = ent_width - sample_start;
        var clipped_width = width_clipped - Math.max(0, clipped_x + width_clipped - cv_width);

        var sample_data = surfaces[entities[i].image].data;
        for (var x = 0; x < clipped_width; x++) {
            if (depth_buffer[clipped_x + x] < p_pos_x) continue;
            for (var y = 0; y < ent_height; y++) {
                var p = (((top_corner + y) * cv_width) + clipped_x + x) * 4;
                var sample_x = Math.floor(((sample_start + x) / ent_width) * 255);
                var sample_y = Math.floor((y / ent_height) * 255);
                var sample_p = ((sample_y * 256) + sample_x) * 4;
                if (sample_data[sample_p + 3] > 128)
                    for (var pp = 0; pp < 3; pp++)
                            surface_data[p + pp] = Math.floor(sample_data[sample_p + pp] * ent_light);
            }
        }
    }
    ctx.putImageData(draw_surface, 0, 0);
    
    // Drawing health bars
    for (var i = 0; i < health_bars.length; i++) {
        var bar = health_bars[i];
        if (bar.x > 0
        && bar.x < depth_buffer.length
        && bar.d < 8
        && depth_buffer[bar.x] > bar.d) {
            var amount = entities[bar.i].hp / entities[bar.i].full_hp;
            ctx.strokeStyle = "#FF0000";
            ctx.beginPath();
            ctx.arc(bar.x, Math.max(cv_height / 20, bar.y), cv_height / 40, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.strokeStyle = "#00FF00";
            ctx.beginPath();
            ctx.arc(bar.x, Math.max(cv_height / 20, bar.y), cv_height / 40, 0, 2 * Math.PI * amount);
            ctx.stroke();
        }
    }

    // Debug map drawing
    if (map_enabled) {
        ctx.fillStyle = "#484848";
        for (var y = 0; y < level_height; y++) {
            for (var x = 0; x < level_width; x++) {
                if (level[y][x] == '#')
                    ctx.fillRect(x * map_scale, y * map_scale, map_scale, map_scale);
            }
        }

        ctx.beginPath();
        ctx.fillStyle = "#F42121";
        ctx.fillRect(player_pos_x * map_scale - (map_scale / 10),
                    player_pos_y * map_scale - (map_scale / 10),
                    map_scale / 5, map_scale / 5);

        ctx.strokeStyle = "#F42121";
        row_increment = fov / 64;
        for (var i = 0; i < 64; i++) {
            ctx.moveTo(player_pos_x * map_scale, player_pos_y * map_scale);

            var rotation = player_rot - (fov / 2) + row_increment * i;
            var vx = Math.cos(rotation);
            var vy = Math.sin(rotation);
            var length = castRay(vx, vy, player_pos_x, player_pos_y);

            ctx.lineTo(player_pos_x * map_scale + (vx * map_scale) * length,
                    player_pos_y * map_scale + (vy * map_scale) * length);
        }
        ctx.stroke();

        ctx.strokeStyle = "#0000FF";
        for (var i = 0; i < entities.length; i++) {
            ctx.beginPath();
            ctx.arc(entities[i].x * map_scale, entities[i].y * map_scale, entities[i].r * map_scale, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    // Gun drawing
    var reload_offset = 0;
    if (reloading) { 
        var multi = (((performance.now() - reloading_time_left) / reload_time) * 2) - 1;
        reload_offset =  (1 - multi * multi) * (cv_height / 2);
    }
    const half_offset = cv_height / 30;
    var bob_offset = half_offset + Math.sin(Math.PI * (1 / step_length) * (walked_distance / step_length)) * half_offset;
    ctx.drawImage(images["res/gunner.png"], 
                        (cv_width / 4) - (cv_height / 2) * (shooting_scaler - 1),
                        (cv_height / 2) + bob_offset + reload_offset,
                        (cv_width / 2) * shooting_scaler,
                        (cv_height / 2) * shooting_scaler);
    shooting_scaler -= dt * 0.01;
    shooting_scaler = Math.max(1, shooting_scaler);

    // Cursor drawing
    ctx.strokeStyle = "#00FF00";
    ctx.beginPath();
    ctx.moveTo((cv_width / 2) - (cv_height / 40), (cv_height / 2));
    ctx.lineTo((cv_width / 2) + (cv_height / 40), (cv_height / 2));
    ctx.moveTo((cv_width / 2), (cv_height / 2) - (cv_height / 40));
    ctx.lineTo((cv_width / 2), (cv_height / 2) + (cv_height / 40));
    ctx.stroke();

    // Healthbar drawing
    ctx.fillStyle = "#FF0000";
    var whole_width = ((cv_height / 30) + (cv_height / 160)) * 7;
    ctx.fillRect((cv_height / 20), cv_height - (cv_height / 20), whole_width, -(cv_height / 40));
    ctx.fillStyle = "#00FF00";
    ctx.fillRect((cv_height / 20), cv_height - (cv_height / 20), 
                 Math.max(0, whole_width * (player_hp / player_full_hp)), -(cv_height / 40));

    // Ammo drawing
    for (var i = 0; i < ammunition; i++) {
        var w_width   = (cv_height / 30);
        var h_height  = (cv_width / 30);
        var x_pos_x   = cv_width - (cv_height / 20) - w_width - (w_width + (cv_height / 160)) * i;
        var y_pos_y   = cv_height - h_height - (cv_height / 20);
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(x_pos_x + (w_width / 2), y_pos_y, (w_width / 2) - 1, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillRect(x_pos_x, y_pos_y, w_width, h_height);
    }
}

function main() {
    loadSurfaces();
    parseMap(level, entities);
    loop();
}

loadImages();
