'use strict'

module.exports = createLinePlot

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var pool = require('typedarray-pool')
var bsearch = require('binary-search-bounds')

var SHADERS = require('./lib/shaders')
var snapLine = require('./lib/sort-line')


function compareScale(a, b) {
  return a.pixelSize - b
}

function LODLine(pixelSize, buffer, idBuffer, count) {
  this.pixelSize = pixelSize
  this.buffer    = buffer
  this.idBuffer  = idBuffer
  this.count     = count
}


function GLLine2D(plot, boxBuffer, lineShader) {
  this.plot       = plot
  this.lodBuffer  = []
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

  var pixelSize   = Math.max(dataX / screenX, dataY / screenY)

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
  boxBuffer.bind()
  attributes.t.pointer(gl.UNSIGNED_BYTE)

  var lod = this.lodBuffer[Math.min(Math.max(bsearch.le(
    this.lodBuffer, pixelSize, compareScale), 0), this.lodBuffer.length-1)]

  lod.buffer.bind()
  attributes.a.pointer(gl.FLOAT, false, 16, 0)
  attributes.b.pointer(gl.FLOAT, false, 16, 8)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, lod.count)
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

  var gl = this.plot.gl

  debugger

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
  var numPoints = this.numPoints = data.length>>>1

  if(numPoints === 0) {
    return
  }

  //Initialize box data
  var boxData  = pool.mallocUint8(4*(numPoints-1))
  for(var i=0; i<numPoints-1; ++i) {
    boxData[4*i]   = 1
    boxData[4*i+1] = 0
    boxData[4*i+2] = 0
    boxData[4*i+3] = 1
  }
  this.boxBuffer.update(boxData)
  pool.free(boxData)

  //Initialize point data
  var outData   = pool.mallocFloat32(4*(numPoints-1))
  var outIds    = pool.mallocUint32(numPoints - 1)
  var plotData  = pool.mallocFloat32(16*(numPoints-1))
  var lastPtr   = 1
  var scale     = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1])
  var lodPtr    = 0
  while(true) {
    scale = Math.sqrt(scale)
    var nextPtr = snapLine(data, scale, outData, outIds, bounds)
    if(nextPtr === lastPtr) {
      continue
    }

    var ax = outData[0]
    var ay = outData[1]
    var ptr = 0
    for(var i=1; i<nextPtr; ++i) {
      var bx = outData[2*i]
      var by = outData[2*i+1]

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
    }

    var lod = this.lodBuffer[lodPtr]
    if(lod) {
      lod.scale = scale
      lod.buffer.update(plotData.subarray(0, ptr))
      lod.idBuffer.update(outIds.subarray(0, nextPtr))
      lod.count = 4*(nextPtr-1)
    } else {
      this.lodBuffer[lodPtr] = new LODLine(
        scale,
        createBuffer(gl, plotData.subarray(0, ptr)),
        createBuffer(gl, outIds.subarray(0, nextPtr)),
        4*(nextPtr-1))
    }
    lodPtr += 1

    if(nextPtr === numPoints) {
      break
    }

    if(scale < 1e-8) {
      break
    }
  }
  pool.free(plotData)
  pool.free(outIds)
  pool.free(outData)

  //Clear out lodBuffer
  while(lodPtr < this.lodBuffer.length) {
    var lod = this.lodBuffer[lodPtr++]
    lod.buffer.dispose()
    lod.idBuffer.dispose()
  }
  this.lodBuffer.length = lodPtr
}

proto.dispose = function() {
  this.boxBuffer.dispose()
  this.lineShader.dispose()
  for(var i=0; i<this.lodBuffer.length; ++i) {
    this.lodBuffer[i].buffer.dispose()
    this.lodBuffer[i].idBuffer.dispose()
  }
}

function createLinePlot(plot, options) {
  var gl = plot.gl
  var boxBuffer  = createBuffer(gl)
  var lineShader = createShader(gl, SHADERS.lineVertex, SHADERS.lineFragment)
  var linePlot = new GLLine2D(plot, boxBuffer, lineShader)
  linePlot.update(options)
  return linePlot
}
