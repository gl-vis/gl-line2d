precision mediump float;

uniform vec4 pickOffset;

varying vec4 pickA, pickB;

void main() {
  vec4 pick = vec4(pickA.xyz, 0);
  if(pickB.w > pickA.w) {
    pick.xyz = pickB.xyz;
  }

  vec4 id = pick + pickOffset;
  id.y += floor(id.x / 256.0);
  id.z += floor(id.y / 256.0);
  id.w += floor(id.z / 256.0);
  id -= 256.0 * floor(id / 256.0);
  gl_FragColor = id / 255.0;
}
