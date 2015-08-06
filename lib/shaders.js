var glslify = require('glslify')

exports.lineVertex   = glslify('./shaders/line-vertex.glsl')
exports.lineFragment = glslify('./shaders/line-fragment.glsl')
