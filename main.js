var canvasWidth = 0;
var canvasHeight = 0;
var d = 0;

var gl;

var rotX = 0;
var rotY = 0;
var rotZ = 0;

var dX = 0;
var dY = 0;
var dZ = 0;

var sX = 1;
var sY = 1;
var sZ = 1;

var polygons = [];
var lights = [];
var material;

$(function () {
    canvas = $('#canvas')[0];
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    d = canvasHeight / 2;

    try {
        gl = canvas.getContext("2d");
    }
    catch (e) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }

    readTextFile("./file.txt");
    draw();
});

function readTextFile(file) {
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4) {
            if (rawFile.status === 200 || rawFile.status == 0) {
                var allText = rawFile.responseText;
                parseFile(allText);
            }
        }
    };
    rawFile.send();
}

function parseFile(text) {
    var vertices = [];
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].split(" ");

        if (line[0].localeCompare("v") == 0) {
            // v x y z nx ny nz
            var x = parseFloat(line[1]);
            var y = parseFloat(line[2]);
            var z = parseFloat(line[3]);
            vertices.push(createVertex(
                x, y, z,
                parseFloat(line[1]),
                parseFloat(line[2]),
                parseFloat(line[3])
            ));
        }
        else if (line[0].localeCompare("f") == 0) {
            var vertex1 = vertices[parseInt(line[1]) - 1];
            var vertex2 = vertices[parseInt(line[2]) - 1];
            var vertex3 = vertices[parseInt(line[3]) - 1];

            polygons.push(createFace(vertex1, vertex2, vertex3, polygons.length));
        }
        else if (line[0].localeCompare("l") == 0) {
            // l x y z L_r L_g L_b
            var light = {
                position: vec3.fromValues(canvasWidth/2 + parseFloat(line[1]), canvasHeight/2 + parseFloat(line[2]), parseFloat(line[3])),
                color: vec3.fromValues(parseFloat(line[4]), parseFloat(line[5]), parseFloat(line[6]))
            };
            lights.push(light);
        }
        else if (line[0].localeCompare("m") == 0) {
            //m Ka_r Ka_g Ka_b Kd_r Kd_g Kd_b Ks_r Ks_g Ks_b Ns
            //Vrednosti K** so med 0 in 1, vrednost Ns pa je med 0 in 1000
            material = {
                Ka: vec3.fromValues(parseFloat(line[1]), parseFloat(line[2]), parseFloat(line[3])),
                Kd: vec3.fromValues(parseFloat(line[4]), parseFloat(line[5]), parseFloat(line[6])),
                Ks: vec3.fromValues(parseFloat(line[7]), parseFloat(line[8]), parseFloat(line[9])),
                Ns: parseInt(line[10])
            };
        }
    }
}

var centerOfGravity = function(polygon) {
    var sum = vec3.create();
    vec3.add(sum, sum, polygon.vertexA.vertex);
    vec3.add(sum, sum, polygon.vertexB.vertex);
    vec3.add(sum, sum, polygon.vertexC.vertex);
    var result = vectorByScalar(sum, 1/3.0);
    return result;
};

var draw = function () {
    gl.clearRect(0, 0, canvas.width, canvas.height);

    gl.beginPath();
    gl.strokeStyle = "#000000";
    gl.moveTo(0, 0);
    gl.lineTo(canvasWidth, 0);
    gl.lineTo(canvasWidth, canvasHeight);
    gl.lineTo(0, canvasHeight);
    gl.lineTo(0, 0);
    gl.stroke();

    var objects = [];

    for (var i = 0; i < polygons.length; i++) {
        var p = clone(polygons[i]);

        var rx = rotateX(rotX);
        var ry = rotateY(rotY);
        var rz = rotateZ(rotZ);
        var scaleMatrix = scale(sX, sY, sZ);
        var translateMatrix = translate(dX, dY, dZ);
        var cameraMatrix = getCameraMatrix();

        var m = multiplyMatrix(cameraMatrix, multiplyMatrix(translateMatrix, multiplyMatrix(rz, multiplyMatrix(ry, multiplyMatrix(rx, scaleMatrix)))));

        p.vertexA.vertex = multiply(p.vertexA.vertex, m);
        p.vertexB.vertex = multiply(p.vertexB.vertex, m);
        p.vertexC.vertex = multiply(p.vertexC.vertex, m);

        calculateLighting(p);

        p.centerOfGravity = centerOfGravity(p);
        p.distance = vec3.distance(p.centerOfGravity, vec4.fromValues(canvasWidth/2, canvasHeight/2, -1));

        objects.push(p);
    }

    objects = objects.sort(function(a,b) {
        return -(a.distance- b.distance);
    });

    for (var i = 0; i < objects.length; i++) {
        var p = objects[i];
        /*gl.beginPath();

        drawLine(p.vertexA.vertex[0], p.vertexA.vertex[1], p.vertexB.vertex[0], p.vertexB.vertex[1], p.vertexA.color, p.vertexB.color);
        drawLine(p.vertexA.vertex[0], p.vertexA.vertex[1], p.vertexC.vertex[0], p.vertexC.vertex[1], p.vertexA.color, p.vertexC.color);
        drawLine(p.vertexC.vertex[0], p.vertexC.vertex[1], p.vertexB.vertex[0], p.vertexB.vertex[1], p.vertexC.color, p.vertexB.color);

        gl.stroke();*/

        var sum = vec3.create();
        vec3.add(sum,sum, p.vertexA.color);
        vec3.add(sum,sum, p.vertexB.color);
        vec3.add(sum,sum, p.vertexC.color);
        sum = vectorByScalar(sum, 1/3.0);

        gl.beginPath();
        gl.fillStyle = "rgb(" + Math.round(sum[0]*255) + "," + Math.round(sum[1]*255) + "," + Math.round(sum[2]*255) + ")";
        gl.moveTo(p.vertexA.vertex[0],p.vertexA.vertex[1]);
        gl.lineTo(p.vertexB.vertex[0],p.vertexB.vertex[1]);
        gl.lineTo(p.vertexC.vertex[0],p.vertexC.vertex[1]);
        gl.fill();
    }
};

var drawLine = function (x0, y0, x1, y1, color1, color2) {
    var grad = gl.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, "rgb(" + Math.round(color1[0]*255) + "," + Math.round(color1[1]*255) + "," + Math.round(color1[2]*255) + ")");
    grad.addColorStop(1, "rgb(" + Math.round(color2[0]*255) + "," + Math.round(color2[1]*255) + "," + Math.round(color2[2]*255) + ")");
    gl.strokeStyle = grad;
    gl.moveTo(x0, y0);
    gl.lineTo(x1, y1);
};

var calculateLighting = function (poly) {
    poly.vertexA.color = calculateColor(poly.vertexA);
    poly.vertexB.color = calculateColor(poly.vertexB);
    poly.vertexC.color = calculateColor(poly.vertexC);
};

var calculateColor = function (vertex) {
    var result = vec3.create();
    for (var i = 0; i < lights.length; i++) {
        var light = lights[i];
        var lm = vec3.fromValues(light.position[0] - vertex.vertex[0], light.position[1] - vertex.vertex[1], light.position[2] - vertex.vertex[2]);
        var n = vertex.normal;

        var lm_normalized = vec3.create();
        var n_normalized = vec3.create();
        vec3.normalize(lm_normalized, lm);
        vec3.normalize(n_normalized, n);

        var lmn = Math.max(0,vec3.dot(lm_normalized, n_normalized));
        var firstPart = vectorByScalar(material.Kd, lmn)

        var rm = vec3.create();
        vec3.subtract(rm, vectorByScalar(n_normalized, 2 * lmn), lm_normalized);

        var v = vec3.fromValues(-vertex.vertex[0], -vertex.vertex[1], -8-vertex.vertex[2]);
        vec3.normalize(v, v);

        var rmv = Math.pow(Math.max(0,vec3.dot(rm, v)), material.Ns);
        var secondPart = vectorByScalar(material.Ks, rmv);

        var sum = vec3.create();
        vec3.add(sum, firstPart, secondPart);

        var r = vec3.create();
        vec3.multiply(r, sum, light.color);

        vec3.add(result, result, r);
    }

    if(result[0] > 1)
        result[0] = 1;
    if(result[1] > 1)
        result[1] = 1;
    if(result[2] > 1)
        result[2] = 1;
    return result;
};

var getCameraMatrix = function () {
    var t = translate(canvasWidth/2, canvasHeight/2, -50);
    var p = perspective(4);

    return multiplyMatrix(p, t);
};

var vectorByScalar = function (vector, scalar) {
    return vec3.fromValues(vector[0] * scalar, vector[1] * scalar, vector[2] * scalar);
};

$(document).keypress(function (e) {
    if (e.which == 113) { // q
        rotX += 0.1;
    } else if (e.which == 97) { // a
        rotX -= 0.1;
    } else if (e.which == 119) { // w
        rotY += 0.1;
    } else if (e.which == 115) { // s
        rotY -= 0.1;
    } else if (e.which == 101) { // e
        rotZ += 0.1;
    } else if (e.which == 100) { // d
        rotZ -= 0.1;
    } else if (e.which == 114) { // r
        sX += 50;
    } else if (e.which == 102) { // f
        sX -= 50;
    } else if (e.which == 116) { // t
        sY += 50;
    } else if (e.which == 103) { // g
        sY -= 50;
    } else if (e.which == 122) { // z
        sZ += 50;
    } else if (e.which == 104) { // h
        sZ -= 50;
    } else if (e.which == 44) { // ,
        dZ += 5;
    } else if (e.which == 46) { // .
        dZ -= 5;
    }
    draw();
});

$(document).keydown(function (e) {
    switch (e.which) {
        case 37: // left
            dX -= 5;
            break;
        case 38: // up
            dY += 5;
            break;
        case 39: // right
            dX += 5;
            break;
        case 40: // down
            dY -= 5;
            break;
        default:
            return;
    }
    draw();
    e.preventDefault();
});

createFace = function (vertexA, vertexB, vertexC, name) {
    return {
        vertexA: vertexA,
        vertexB: vertexB,
        vertexC: vertexC,
        name: name,
        centerOfGravity: vec3.create(),
        distance: 0,
    };
};

createVertex = function (x, y, z, nx, ny, nz) {
    return {
        vertex: vec4.fromValues(x, y, z, 1),
        normal: vec3.fromValues(nx, ny, nz),
        color: vec3.fromValues(0, 0, 0)
    };
};

clone = function (poly) {
    return createFace(
        createVertex(poly.vertexA.vertex[0], poly.vertexA.vertex[1], poly.vertexA.vertex[2], poly.vertexA.normal[0], poly.vertexA.normal[1], poly.vertexA.normal[2]),
        createVertex(poly.vertexB.vertex[0], poly.vertexB.vertex[1], poly.vertexB.vertex[2], poly.vertexB.normal[0], poly.vertexB.normal[1], poly.vertexB.normal[2]),
        createVertex(poly.vertexC.vertex[0], poly.vertexC.vertex[1], poly.vertexC.vertex[2], poly.vertexC.normal[0], poly.vertexC.normal[1], poly.vertexC.normal[2]),
        poly.name
    );
};

rotateX = function (alpha) {
    var cosA = Math.cos(alpha);
    var sinA = Math.sin(alpha);

    return [
        1, 0, 0, 0,
        0, cosA, -sinA, 0,
        0, sinA, cosA, 0,
        0, 0, 0, 1
    ];
};

rotateY = function (alpha) {
    var cosA = Math.cos(alpha);
    var sinA = Math.sin(alpha);

    return [
        cosA, 0, sinA, 0,
        0, 1, 0, 0,
        -sinA, 0, cosA, 0,
        0, 0, 0, 1
    ];
};

rotateZ = function (alpha) {
    var cosA = Math.cos(alpha);
    var sinA = Math.sin(alpha);

    return [
        cosA, -sinA, 0, 0,
        sinA, cosA, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
};

translate = function (dx, dy, dz) {
    return [
        1, 0, 0, dx,
        0, 1, 0, dy,
        0, 0, 1, dz,
        0, 0, 0, 1
    ];
};

scale = function (sx, sy, sz) {
    return [
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1
    ];
};

perspective = function (parameter) {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, (1 / parameter), 0
    ];
};

multiply = function (v, mat) {
    var t = vec4.create();

    t[0] = mat[0] * v[0] + mat[1] * v[1] + mat[2] * v[2] + mat[3] * v[3];
    t[1] = mat[4] * v[0] + mat[5] * v[1] + mat[6] * v[2] + mat[7] * v[3];
    t[2] = mat[8] * v[0] + mat[9] * v[1] + mat[10] * v[2] + mat[11] * v[3];
    t[3] = mat[12] * v[0] + mat[13] * v[1] + mat[14] * v[2] + mat[15] * v[3];

    return t;
};

multiplyMatrix = function (mat1, mat2) {
    var m = mat4.create();

    m[0] = mat1[0] * mat2[0] + mat1[1] * mat2[4] + mat1[2] * mat2[8] + mat1[3] * mat2[12];
    m[1] = mat1[0] * mat2[1] + mat1[1] * mat2[5] + mat1[2] * mat2[9] + mat1[3] * mat2[13];
    m[2] = mat1[0] * mat2[2] + mat1[1] * mat2[6] + mat1[2] * mat2[10] + mat1[3] * mat2[14];
    m[3] = mat1[0] * mat2[3] + mat1[1] * mat2[7] + mat1[2] * mat2[11] + mat1[3] * mat2[15];

    m[4] = mat1[4] * mat2[0] + mat1[5] * mat2[4] + mat1[6] * mat2[8] + mat1[7] * mat2[12];
    m[5] = mat1[4] * mat2[1] + mat1[5] * mat2[5] + mat1[6] * mat2[9] + mat1[7] * mat2[13];
    m[6] = mat1[4] * mat2[2] + mat1[5] * mat2[6] + mat1[6] * mat2[10] + mat1[7] * mat2[14];
    m[7] = mat1[4] * mat2[3] + mat1[5] * mat2[7] + mat1[6] * mat2[11] + mat1[7] * mat2[15];

    m[8] = mat1[8] * mat2[0] + mat1[9] * mat2[4] + mat1[10] * mat2[8] + mat1[11] * mat2[12];
    m[9] = mat1[8] * mat2[1] + mat1[9] * mat2[5] + mat1[10] * mat2[9] + mat1[11] * mat2[13];
    m[10] = mat1[8] * mat2[2] + mat1[9] * mat2[6] + mat1[10] * mat2[10] + mat1[11] * mat2[14];
    m[11] = mat1[8] * mat2[3] + mat1[9] * mat2[7] + mat1[10] * mat2[11] + mat1[11] * mat2[15];

    m[12] = mat1[12] * mat2[0] + mat1[13] * mat2[4] + mat1[14] * mat2[8] + mat1[15] * mat2[12];
    m[13] = mat1[12] * mat2[1] + mat1[13] * mat2[5] + mat1[14] * mat2[9] + mat1[15] * mat2[13];
    m[14] = mat1[12] * mat2[2] + mat1[13] * mat2[6] + mat1[14] * mat2[10] + mat1[15] * mat2[14];
    m[15] = mat1[12] * mat2[3] + mat1[13] * mat2[7] + mat1[14] * mat2[11] + mat1[15] * mat2[15];

    return m;
};