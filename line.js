'use strict'

module.exports = createLinePlot

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var pool = require('typedarray-pool')

var SHADERS = require('./lib/shaders')
function compareScale(a, b) {
  return b - a.pixelSize
}

function GLLine2D(
  plot,
  lineBuffer,
  pickBuffer,
  lineShader,
  mitreShader,
  fillShader,
  pickShader) {

  this.plot       = plot
  this.lineBuffer = lineBuffer
  this.pickBuffer = pickBuffer
  this.lineShader = lineShader
  this.mitreShader = mitreShader
  this.fillShader  = fillShader
  this.pickShader  = pickShader

  this.bounds     = [Infinity, Infinity, -Infinity, -Infinity]

  this.width      = 1
  this.color      = [0,0,1,1]

  //Fill to axes
  this.fill       = [false, false, false, false]
  this.fillColor  = [[0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1]]

  this.data       = null
  this.numPoints  = 0
  this.vertCount  = 0

  this.pickOffset = 0

  this.lodBuffer = []
}

var proto = GLLine2D.prototype

proto.draw = (function() {
var MATRIX = [1, 0, 0,
              0, 1, 0,
              0, 0, 1]
var SCREEN_SHAPE = [0,0]
var PX_AXIS = [1,0]
var NX_AXIS = [-1,0]
var PY_AXIS = [0,1]
var NY_AXIS = [0,-1]
return function() {
  var plot      = this.plot
  var color     = this.color
  var width     = this.width
  var numPoints = this.numPoints
  var bounds    = this.bounds
  var count     = this.vertCount

  var gl        = plot.gl
  var viewBox   = plot.viewBox
  var dataBox   = plot.dataBox
  var pixelRatio = plot.pixelRatio

  var boundX  = bounds[2] - bounds[0]
  var boundY  = bounds[3] - bounds[1]
  var dataX   = dataBox[2] - dataBox[0]
  var dataY   = dataBox[3] - dataBox[1]
  var screenX = viewBox[2] - viewBox[0]
  var screenY = viewBox[3] - viewBox[1]

  var pixelSize   = Math.max(dataX / screenX, dataY / screenY) / pixelRatio

  MATRIX[0] = 2.0 * boundX / dataX
  MATRIX[4] = 2.0 * boundY / dataY
  MATRIX[6] = 2.0 * (bounds[0] - dataBox[0]) / dataX - 1.0
  MATRIX[7] = 2.0 * (bounds[1] - dataBox[1]) / dataY - 1.0

  SCREEN_SHAPE[0] = screenX
  SCREEN_SHAPE[1] = screenY

  var buffer    = this.lineBuffer
  buffer.bind()

  var fill = this.fill

  if(fill[0] || fill[1] || fill[2] || fill[3]) {

    var fillShader = this.fillShader
    fillShader.bind()

    var fillUniforms = fillShader.uniforms
    fillUniforms.matrix = MATRIX
    fillUniforms.depth = plot.nextDepthValue()

    var fillAttributes = fillShader.attributes
    fillAttributes.a.pointer(gl.FLOAT, false, 16, 0)
    fillAttributes.d.pointer(gl.FLOAT, false, 16, 8)

    gl.depthMask(true)
    gl.enable(gl.DEPTH_TEST)

    var fillColor = this.fillColor
    if(fill[0]) {
      fillUniforms.color        = fillColor[0]
      fillUniforms.projectAxis  = NX_AXIS
      fillUniforms.projectValue = 1
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    if(fill[1]) {
      fillUniforms.color        = fillColor[1]
      fillUniforms.projectAxis  = NY_AXIS
      fillUniforms.projectValue = 1
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    if(fill[2]) {
      fillUniforms.color        = fillColor[2]
      fillUniforms.projectAxis  = PX_AXIS
      fillUniforms.projectValue = 1
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    if(fill[3]) {
      fillUniforms.color        = fillColor[3]
      fillUniforms.projectAxis  = PY_AXIS
      fillUniforms.projectValue = 1
      gl.drawArrays(gl.TRIANGLES, 0, count)
    }

    gl.depthMask(false)
    gl.disable(gl.DEPTH_TEST)
  }

  var shader    = this.lineShader
  shader.bind()

  var uniforms = shader.uniforms
  uniforms.matrix = MATRIX
  uniforms.color  = color
  uniforms.width  = width * pixelRatio
  uniforms.screenShape = SCREEN_SHAPE

  var attributes = shader.attributes
  attributes.a.pointer(gl.FLOAT, false, 16, 0)
  attributes.d.pointer(gl.FLOAT, false, 16, 8)

  gl.drawArrays(gl.TRIANGLES, 0, count)

  //Draw mitres
  if(width > 2) {
    var mshader = this.mitreShader
    mshader.bind()

    var muniforms = mshader.uniforms
    muniforms.matrix = MATRIX
    muniforms.color  = color
    muniforms.screenShape = SCREEN_SHAPE
    muniforms.radius = width * pixelRatio

    mshader.attributes.p.pointer(gl.FLOAT, false, 48, 0)
    gl.drawArrays(gl.POINTS, 0, (count/3)|0)
  }
}
})()

proto.drawPick = (function() {
  var MATRIX = [1, 0, 0,
                0, 1, 0,
                0, 0, 1]
  var SCREEN_SHAPE = [0,0]
  var PICK_OFFSET = [0,0,0,0]
  return function(pickOffset) {
    var plot      = this.plot
    var shader    = this.pickShader
    var buffer    = this.lineBuffer
    var pickBuffer= this.pickBuffer
    var width     = this.width
    var numPoints = this.numPoints
    var bounds    = this.bounds
    var count     = this.vertCount


    var gl        = plot.gl
    var viewBox   = plot.viewBox
    var dataBox   = plot.dataBox
    var pixelRatio = plot.pixelRatio

    var boundX  = bounds[2] - bounds[0]
    var boundY  = bounds[3] - bounds[1]
    var dataX   = dataBox[2] - dataBox[0]
    var dataY   = dataBox[3] - dataBox[1]
    var screenX = viewBox[2] - viewBox[0]
    var screenY = viewBox[3] - viewBox[1]

    var pixelSize   = Math.max(dataX / screenX, dataY / screenY) / pixelRatio

    this.pickOffset = pickOffset

    MATRIX[0] = 2.0 * boundX / dataX
    MATRIX[4] = 2.0 * boundY / dataY
    MATRIX[6] = 2.0 * (bounds[0] - dataBox[0]) / dataX - 1.0
    MATRIX[7] = 2.0 * (bounds[1] - dataBox[1]) / dataY - 1.0

    SCREEN_SHAPE[0] = screenX
    SCREEN_SHAPE[1] = screenY

    PICK_OFFSET[0] =  pickOffset       & 0xff
    PICK_OFFSET[1] = (pickOffset>>>8)  & 0xff
    PICK_OFFSET[2] = (pickOffset>>>16) & 0xff
    PICK_OFFSET[3] =  pickOffset>>>24

    shader.bind()

    var uniforms = shader.uniforms
    uniforms.matrix      = MATRIX
    uniforms.width       = width * pixelRatio
    uniforms.pickOffset  = PICK_OFFSET
    uniforms.screenShape = SCREEN_SHAPE

    var attributes = shader.attributes

    buffer.bind()
    attributes.a.pointer(gl.FLOAT, false, 16, 0)
    attributes.d.pointer(gl.FLOAT, false, 16, 8)

    pickBuffer.bind()
    attributes.pick0.pointer(gl.UNSIGNED_BYTE, false, 8, 0)
    attributes.pick1.pointer(gl.UNSIGNED_BYTE, false, 8, 4)

    gl.drawArrays(gl.TRIANGLES, 0, count)

    return pickOffset+numPoints
  }
})()

proto.pick = function(x, y, value) {
  var pickOffset = this.pickOffset
  var pointCount = this.numPoints
  if(value < pickOffset || value >= pickOffset + pointCount) {
    return null
  }
  var pointId = value - pickOffset
  var points = this.data
  return {
    object:    this,
    pointId:   pointId,
    dataCoord: [ points[2*pointId], points[2*pointId+1] ]
  }
}

function deepCopy(arr) {
  return arr.map(function(x) {
    return x.slice()
  })
}

proto.update = function(options) {
  options = options || {}

  var gl = this.plot.gl

  this.color = (options.color || [0,0,1,1]).slice()
  this.width = +(options.width || 1)

  this.fill      = (options.fill || [false,false,false,false]).slice()
  this.fillColor = deepCopy(options.fillColor || [[0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1]])

  var data = options.positions
  this.data = data

  var bounds = this.bounds
  bounds[0] = bounds[1] = Infinity
  bounds[2] = bounds[3] = -Infinity

  var numPoints = this.numPoints = data.length>>>1
  if(numPoints === 0) {
    return
  }

  for(var i=0; i<numPoints; ++i) {
    var ax = data[2*i]
    var ay = data[2*i+1]
    bounds[0] = Math.min(bounds[0], ax)
    bounds[1] = Math.min(bounds[1], ay)
    bounds[2] = Math.max(bounds[2], ax)
    bounds[3] = Math.max(bounds[3], ay)
  }

  //Generate line data
  var lineData    = pool.mallocFloat32(24*(numPoints-1))
  var pickData    = pool.mallocUint32(12*(numPoints-1))
  var lineDataPtr = lineData.length
  var pickDataPtr = pickData.length
  var ptr = numPoints


  this.vertCount = 6 * (numPoints - 1)

  while(ptr > 1) {
    var id = --ptr
    var ax = data[2*ptr]
    var ay = data[2*ptr+1]

    ax = (ax - bounds[0]) / (bounds[2] - bounds[0])
    ay = (ay - bounds[1]) / (bounds[3] - bounds[1])

    var next = id-1
    var bx = data[2*next]
    var by = data[2*next+1]

    bx = (bx - bounds[0]) / (bounds[2] - bounds[0])
    by = (by - bounds[1]) / (bounds[3] - bounds[1])

    var dx = bx - ax
    var dy = by - ay

    var akey0 = id     | (1<<24)
    var akey1 = (id-1)
    var bkey0 = id
    var bkey1 = (id-1) | (1<<24)

    lineData[--lineDataPtr] = -dy
    lineData[--lineDataPtr] = -dx
    lineData[--lineDataPtr] = ay
    lineData[--lineDataPtr] = ax
    pickData[--pickDataPtr] = akey0
    pickData[--pickDataPtr] = akey1

    lineData[--lineDataPtr] = dy
    lineData[--lineDataPtr] = dx
    lineData[--lineDataPtr] = by
    lineData[--lineDataPtr] = bx
    pickData[--pickDataPtr] = bkey0
    pickData[--pickDataPtr] = bkey1

    lineData[--lineDataPtr] = -dy
    lineData[--lineDataPtr] = -dx
    lineData[--lineDataPtr] = by
    lineData[--lineDataPtr] = bx
    pickData[--pickDataPtr] = bkey0
    pickData[--pickDataPtr] = bkey1

    lineData[--lineDataPtr] = dy
    lineData[--lineDataPtr] = dx
    lineData[--lineDataPtr] = by
    lineData[--lineDataPtr] = bx
    pickData[--pickDataPtr] = bkey0
    pickData[--pickDataPtr] = bkey1

    lineData[--lineDataPtr] = -dy
    lineData[--lineDataPtr] = -dx
    lineData[--lineDataPtr] = ay
    lineData[--lineDataPtr] = ax
    pickData[--pickDataPtr] = akey0
    pickData[--pickDataPtr] = akey1

    lineData[--lineDataPtr] = dy
    lineData[--lineDataPtr] = dx
    lineData[--lineDataPtr] = ay
    lineData[--lineDataPtr] = ax
    pickData[--pickDataPtr] = akey0
    pickData[--pickDataPtr] = akey1
  }

  this.lineBuffer.update(lineData)
  this.pickBuffer.update(pickData)

  pool.free(lineData)
  pool.free(pickData)
}

proto.dispose = function() {
  this.plot.removeObject(this)
  this.lineBuffer.dispose()
  this.lineShader.dispose()
}

function createLinePlot(plot, options) {
  var gl = plot.gl
  var lineBuffer  = createBuffer(gl)
  var pickBuffer  = createBuffer(gl)
  var lineShader  = createShader(gl, SHADERS.lineVertex, SHADERS.lineFragment)
  var mitreShader = createShader(gl, SHADERS.mitreVertex, SHADERS.mitreFragment)
  var fillShader  = createShader(gl, SHADERS.fillVertex, SHADERS.lineFragment)
  var pickShader  = createShader(gl, SHADERS.pickVertex, SHADERS.pickFragment)
  var linePlot    = new GLLine2D(
    plot,
    lineBuffer,
    pickBuffer,
    lineShader,
    mitreShader,
    fillShader,
    pickShader)
  plot.addObject(linePlot)
  linePlot.update(options)
  return linePlot
}
