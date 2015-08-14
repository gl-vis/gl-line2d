precision mediump float;

uniform vec4 color;

void main() {
  if(length(gl_PointCoord.xy - 0.5) > 0.25) {
    discard;
  }
  gl_FragColor = color;
}
