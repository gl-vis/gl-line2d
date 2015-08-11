precision mediump float;

#pragma glslify: inverse = require("glsl-inverse")

attribute vec2 a, d;

uniform mat3 matrix;
uniform vec2 screenShape;
uniform float width;

void main() {
  vec3 base = matrix * vec3(a, 1);
  vec2 n = 0.5 * width * normalize(vec2(d.y, -d.x)) / screenShape.xy;
  gl_Position = vec4(base.xy/base.z + n, 0, 1);
}
