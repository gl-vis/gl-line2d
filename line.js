'use strict'

module.exports = createLinePlot

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var pool = require('typedarray-pool')
var bsearch = require('binary-search-bounds')
var snapPoints = require('snap-points-2d')

var SHADERS = require('./lib/shaders')

function LODEntry(pixelSize, offset, count) {
  this.pixelSize = pixelSize
  this.offset = offset
  this.count = count
}

function compareScale(a, b) {
  return b - a.pixelSize
}

function GLLine2D(plot, lineBuffer, lineShader) {
  this.plot       = plot
  this.lineBuffer = lineBuffer
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


  this.lodBuffer = []
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

  var pixelSize   = Math.max(dataX / screenX, dataY / screenY) / pixelRatio

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
  var lod = this.lodBuffer[Math.min(Math.max(bsearch.le(
    this.lodBuffer, pixelSize, compareScale), 0), this.lodBuffer.length-1)]

  buffer.bind()
  attributes.a.pointer(gl.FLOAT, false, 16, 0)
  attributes.d.pointer(gl.FLOAT, false, 16, 8)

  gl.drawArrays(gl.TRIANGLES, lod.offset, lod.count)
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

  this.color = (options.color || [0,0,1,1]).slice()
  this.width = +(options.width || 1)

  this.fill      = (options.fill || [false,false,false,false]).slice()
  this.fillColor = deepCopy(options.fillColor || [[0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1],
                     [0,0,0,1]])

  var data = options.positions
  this.data = data

  var numPoints = this.numPoints = data.length>>>1
  if(numPoints === 0) {
    return
  }

  //Initialize point data and compute bounds
  var pointData = pool.mallocFloat32(2*numPoints)
  var outData   = pool.mallocFloat32(2*numPoints)
  var outIds    = pool.mallocUint32(numPoints)
  pointData.set(data)
  var lod       = snapPoints(pointData, outData, outIds, this.bounds)
  pool.free(pointData)

  //Compute inverse permutation
  var invIds    = pool.mallocUint32(numPoints)
  for(var i=0; i<numPoints; ++i) {
    invIds[outIds[i]] = i
  }

  //Generate line lods
  var lineData    = pool.mallocFloat32(24*(numPoints-1))
  var lineLOD     = this.lodBuffer
  var lineDataPtr = lineData.length
  var ptr         = numPoints
  lineLOD.length = 0
  for(var i=0; i<lod.length; ++i) {
    var level = lod[i]
    var levelStart = level.offset
    while(ptr > levelStart) {
      var id = outIds[--ptr]
      var ax = outData[2*ptr]
      var ay = outData[2*ptr+1]
      if(id > 0) {
        var next = invIds[id - 1]
        if(next < ptr) {
          var bx = outData[2*next]
          var by = outData[2*next+1]

          var dx = bx - ax
          var dy = by - ay

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax
        }
      }
      if(id < numPoints-1) {
        var next = invIds[id + 1]
        if(next < ptr) {
          var bx = outData[2*next]
          var by = outData[2*next+1]

          var dx = bx - ax
          var dy = by - ay

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = -dy
          lineData[--lineDataPtr] = -dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = by
          lineData[--lineDataPtr] = bx

          lineData[--lineDataPtr] = dy
          lineData[--lineDataPtr] = dx
          lineData[--lineDataPtr] = ay
          lineData[--lineDataPtr] = ax
        }
      }
    }

    lineLOD.push(new LODEntry(
      level.pixelSize,
      lineDataPtr>>2,
      (lineData.length-lineDataPtr)>>2
    ))
  }

  this.lineBuffer.update(lineData)

  pool.free(lineData)
  pool.free(outData)
  pool.free(outIds)
}

proto.dispose = function() {
  this.lineBuffer.dispose()
  this.lineShader.dispose()
}

function createLinePlot(plot, options) {
  var gl = plot.gl
  var lineBuffer  = createBuffer(gl)
  var lineShader = createShader(gl, SHADERS.lineVertex, SHADERS.lineFragment)
  var linePlot = new GLLine2D(plot, lineBuffer, lineShader)
  linePlot.update(options)
  return linePlot
}
