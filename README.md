gl-line2d
============
WebGL 2D line plots for lots of data points

## Example
For now, see [`gl-plot2d`](https://github.com/gl-vis/gl-plot2d).

## Install
Using [npm](https://docs.npmjs.com/), you can install this module as follows:

```
npm i gl-line2d
```

### Options

Option | Meaning
---|---
`positions` | Array with sequence of points to connect lines, akin to sequence of `ctx.lineTo()` calls, eg. `[0,0, 1,1, 0,2, 1,-1]`
`color` | Array with channel values `[0, .2, .5, 1]`
`width` | Line width, number, defaults to `1`
`fill` | Array with 4 values to fill area under the line towards direction of an axis `[false, true, false, false]`
`fillColor` | Array with colors corresponding to filling areas, eg. `[[0,0,0,1], [0,0,1,1], [0,1,0,1], [.5,.5,0,1]]`
`dashes` | Array with dash lengths, altering color/space pairs, ie. `[2,10, 5,10, ...]`
