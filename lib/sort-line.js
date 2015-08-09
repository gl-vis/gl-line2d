'use strict'

module.exports = snapToScale

function snapToScale(positions, scale, result, resultIds, bounds) {
  var ptr = 0
  var lastX = positions[0]
  var lastY = positions[1]
  var lastI = 0

  var scaleX = 1.0 / (bounds[2] - bounds[0])
  var scaleY = 1.0 / (bounds[3] - bounds[1])
  var shiftX = bounds[0]
  var shiftY = bounds[1]
  result[2*ptr] = (lastX - shiftX) * scaleX
  result[2*ptr+1] = (lastY - shiftY) * scaleY
  resultIds[ptr] = 0
  ptr += 1
  for(var i=2; i<positions.length; i+=2) {
    var nextX = positions[i]
    var nextY = positions[i+1]
    var nextI = i

    var dx = nextX - lastX
    var dy = nextY - lastY

    var len = Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2))
    if(len <= 1e-8) {
      i += 2
      continue
    }
    dx /= len
    dy /= len

    var w = dy * lastX - dx * lastY
    var v = dx * lastX + dy * lastY

    var enterI = lastI
    var loI    = lastI
    var hiI    = nextI
    var exitI  = nextI

    var dLo = 0
    var dHi = dx * nextX + dy * nextY - v

    for(var j=i+2; j<positions.length; j+=2) {
      var jX = positions[j]
      var jY = positions[j+1]

      var dJ = Math.abs(jX * dy - jY * dx - w)
      if(dJ > scale) {
        break
      }

      exitI = j

      var dL = jX * dx + jY * dy - v
      if(dL < dLo) {
        dLo = dL
        hiI = j
      }
      if(dL > dHi) {
        dHi = dL
        loI = j
      }
    }

    if(hiI < loI) {
      var tmp = hiI
      hiI = loI
      loI = tmp
    }

    var aI = Math.min(loI, hiI)
    var bI = Math.max(loI, hiI)
    var cI = exitI

    if(enterI !== aI) {
      result[2*ptr]   = (positions[aI] - shiftX)   * scaleX
      result[2*ptr+1] = (positions[aI+1] - shiftY) * scaleY
      resultIds[ptr]  = aI
      ptr += 1
    }
    if(aI !== bI) {
      result[2*ptr]   = (positions[bI] - shiftX)   * scaleX
      result[2*ptr+1] = (positions[bI+1] - shiftY) * scaleY
      resultIds[ptr]  = bI
      ptr += 1
    }
    if(exitI !== cI) {
      result[2*ptr]   = (positions[cI] - shiftX)   * scaleX
      result[2*ptr+1] = (positions[cI+1] - shiftY) * scaleY
      resultIds[ptr]  = cI
      ptr += 1
    }

    i = exitI
    lastX = nextX
    lastY = nextY
    lastI = exitI
  }
  return ptr
}
