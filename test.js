'use strict'

/**
 * Test multiple points
 */
require('enable-mobile')
const random = require('gauss-random')
var fit = require('canvas-fit')
var mouseWheel = require('mouse-wheel')
var mouseChange = require('mouse-change')
var createLine = require('./')
var createPlot = require('gl-plot2d')
var fps = require('fps-indicator')({
    position: 'bottom-left'
})


var N = 1e3

var positions = new Float32Array(2 * N)
for(var i=0; i<2*N; i+=2) {
  positions[i]   = (i/N)*10.0-10.0
  positions[i+1] = random()
}

positions[11] = 1e10


setup({
	positions: positions,

  // positions: [0,0, 1,1, 2,0, 1,-1],
  // color: [0,.5,0,.5],

  // dashes: [2, 10, 5, 10],
  // fill: [true, true, true, true],
  // fillColor: [
  //   [0,0,1,0.5],
  //   [0,1,0,0.5],
  //   [1,0,0,0.5],
  //   [1,0,1,0.5]],

  width: 2
})





function setup (options) {
  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  window.addEventListener('resize', fit(canvas, null, +window.devicePixelRatio), false)

  var gl = canvas.getContext('webgl', {
    depth: false,
    // alpha: true,
    // premultipliedAlpha: true
  })

  var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight
  var dataBox = [-10,-10/aspect,10,10/aspect]

  var plot = createPlot({
    gl:             gl,
    pixelRatio:     1,
    borderLineEnable: [false,false,false,false],
    labelEnable: [false, false],
    tickEnable: [false, false],
    gridLineEnable: [false, false],
    zeroLineEnable: [false, false],
    viewBox: [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight],
  })


  var line = createLine(plot, options)


  var lastX = 0, lastY = 0
  var boxStart = [0,0]
  var boxEnd   = [0,0]
  var boxEnabled = false
  mouseChange(function(buttons, x, y, mods) {
    y = window.innerHeight - y
    x *= plot.pixelRatio
    y *= plot.pixelRatio

    if(buttons & 1) {
      if(mods.shift) {
        var dataX = (x - plot.viewBox[0]) / (plot.viewBox[2]-plot.viewBox[0]) * (dataBox[2] - dataBox[0]) + dataBox[0]
        var dataY = (y - plot.viewBox[1]) / (plot.viewBox[3]-plot.viewBox[1]) * (dataBox[3] - dataBox[1]) + dataBox[1]
        if(!boxEnabled) {
          boxStart[0] = dataX
          boxStart[1] = dataY
        }
        boxEnd[0] = dataX
        boxEnd[1] = dataY
        boxEnabled = true
      } else {
        var dx = (lastX - x) * (dataBox[2] - dataBox[0]) / (plot.viewBox[2]-plot.viewBox[0])
        var dy = (lastY - y) * (dataBox[3] - dataBox[1]) / (plot.viewBox[3] - plot.viewBox[1])

        dataBox[0] += dx
        dataBox[1] += dy
        dataBox[2] += dx
        dataBox[3] += dy

        plot.setDataBox(dataBox)
      }
    } else {
      var result = plot.pick(x/plot.pixelRatio, y/plot.pixelRatio)
    }

    lastX = x
    lastY = y
  })

  mouseWheel(function(dx, dy, dz) {
    var scale = Math.exp(0.1 * dy / gl.drawingBufferHeight)

    var cx = (lastX - plot.viewBox[0]) / (plot.viewBox[2] - plot.viewBox[0]) * (dataBox[2] - dataBox[0]) + dataBox[0]
    var cy = (plot.viewBox[1] - lastY) / (plot.viewBox[3] - plot.viewBox[1]) * (dataBox[3] - dataBox[1]) + dataBox[3]

    dataBox[0] = (dataBox[0] - cx) * scale + cx
    dataBox[1] = (dataBox[1] - cy) * scale + cy
    dataBox[2] = (dataBox[2] - cx) * scale + cx
    dataBox[3] = (dataBox[3] - cy) * scale + cy

    plot.setDataBox(dataBox)

    return true
  })

  function render() {
    requestAnimationFrame(render)
    plot.draw()
  }

  render()

  return line
}
