'use strict'

module.exports = createLinePlot

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var pool = require('typedarray-pool')

var SHADERS = require('./lib/shaders')

function GLLine2D(plot, lineBuffer, boxBuffer, lineShader) {
  this.plot       = plot
  this.lineBuffer = lineBuffer
  this.boxBuffer  = boxBuffer
  this.lineShader = lineShader

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
}

var proto = GLLine2D.prototype

proto.draw = (function() {
var MATRIX = [1, 0, 0,
              0, 1, 0,
              0, 0, 1]
var SCREEN_SHAPE = [0,0]
return function() {
  var plot      = this.plot
  var shader    = this.lineShader
  var buffer    = this.lineBuffer
  var boxBuffer = this.boxBuffer
  var color     = this.color
  var width     = this.width
  var numPoints = this.numPoints
  var bounds    = this.bounds

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

  MATRIX[0] = 2.0 * boundX / dataX
  MATRIX[4] = 2.0 * boundY / dataY
  MATRIX[6] = 2.0 * (bounds[0] - dataBox[0]) / dataX - 1.0
  MATRIX[7] = 2.0 * (bounds[1] - dataBox[1]) / dataY - 1.0

  SCREEN_SHAPE[0] = screenX
  SCREEN_SHAPE[1] = screenY

  shader.bind()

  var uniforms = shader.uniforms
  uniforms.matrix = MATRIX
  uniforms.color  = color
  uniforms.width  = width * pixelRatio
  uniforms.screenShape = SCREEN_SHAPE

  var attributes = shader.attributes
  buffer.bind()
  attributes.a.pointer(gl.FLOAT, false, 16, 0)
  attributes.b.pointer(gl.FLOAT, false, 16, 8)
  boxBuffer.bind()
  attributes.t.pointer(gl.UNSIGNED_BYTE)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4*(numPoints-1))
}
})()

proto.drawPick = (function() {
return function(pickOffset) {
  return pickOffset
}
})()

proto.pick = function(x, y, value) {
  return null
}

function deepCopy(arr) {
  return arr.map(function(x) {
    return x.slice()
  })
}

proto.update = function(options) {
  options = options || {}

  this.color = (options.color || [0,0,1,1]).slice()
  this.width = +(options.width || 1)

  this.fill      = (options.fill || [false,false,false,false]).slice()
  this.fillColor = deepCopy(options.fillColor || [[0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1]])

  var data = options.positions
  var bounds = this.bounds
  bounds[0] = bounds[1] = Infinity
  bounds[2] = bounds[3] = -Infinity
  for(var i=0; i<data.length; i+=2) {
    var x = data[i]
    var y = data[i+1]
    bounds[0] = Math.min(bounds[0],x)
    bounds[1] = Math.min(bounds[1],y)
    bounds[2] = Math.max(bounds[2],x)
    bounds[3] = Math.max(bounds[3],y)
  }
  if(bounds[0] === bounds[2]) {
    bounds[2] += 1
  }
  if(bounds[1] === bounds[3]) {
    bounds[3] += 1
  }

  this.data = data
  this.numPoints = data.length>>>1

  //Rescale points into line buffer and upload
  var plotData = pool.mallocFloat32(16*(this.numPoints-1))
  var boxData  = pool.mallocUint8(4*(this.numPoints-1))
  var ptr = 0
  var bptr = 0
  var ax = (data[0] - bounds[0]) / (bounds[2] - bounds[0])
  var ay = (data[1] - bounds[1]) / (bounds[3] - bounds[1])
  for(var i=2; i<data.length; i+=2) {
    var bx = (data[i] - bounds[0])   / (bounds[2] - bounds[0])
    var by = (data[i+1] - bounds[1]) / (bounds[3] - bounds[1])
    plotData[ptr++] = ax
    plotData[ptr++] = ay
    plotData[ptr++] = bx
    plotData[ptr++] = by

    plotData[ptr++] = ax
    plotData[ptr++] = ay
    plotData[ptr++] = bx
    plotData[ptr++] = by

    plotData[ptr++] = bx
    plotData[ptr++] = by
    plotData[ptr++] = ax
    plotData[ptr++] = ay

    plotData[ptr++] = bx
    plotData[ptr++] = by
    plotData[ptr++] = ax
    plotData[ptr++] = ay

    ax = bx
    ay = by

    boxData[bptr++] = 1
    boxData[bptr++] = 0
    boxData[bptr++] = 0
    boxData[bptr++] = 1
  }
  pool.free(plotData)
  pool.free(boxData)
  this.lineBuffer.update(plotData)
  this.boxBuffer.update(boxData)
}

proto.dispose = function() {
  this.lineBuffer.dispose()
  this.lineShader.dispose()
}

function createLinePlot(plot, options) {
  var gl = plot.gl
  var lineBuffer = createBuffer(gl)
  var boxBuffer  = createBuffer(gl)
  var lineShader = createShader(gl, SHADERS.lineVertex, SHADERS.lineFragment)
  var linePlot = new GLLine2D(plot, lineBuffer, boxBuffer, lineShader)
  linePlot.update(options)
  return linePlot
}
