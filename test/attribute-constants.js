var tape = require('tape')
var extend = require('../lib/util/extend')
var createContext = require('./util/create-context')
var createREGL = require('../regl')

tape('attribute constants', function (t) {
  var gl = createContext(2, 2)
  var regl = createREGL(gl)

  var vert = [
    'precision highp float;',
    'attribute vec2 position;',
    'attribute vec4 color;',
    'varying vec4 fragColor;',
    'void main () {',
    '  fragColor = color;',
    '  gl_Position = vec4(position, 0, 1);',
    '}'
  ].join('\n')

  var frag = [
    'precision highp float;',
    'varying vec4 fragColor;',
    'void main () {',
    '  gl_FragColor = fragColor;',
    '}'
  ].join('\n')

  var baseDesc = {
    vert: vert,
    frag: frag,
    attributes: {
      position: [
        0, -4,
        -4, 4,
        4, 4
      ]
    },
    count: 3,
    depth: {enable: false},
    primitive: 'triangles'
  }

  var colors = {
    'scalar': 1,
    '1': [1],
    '2': [1, 1],
    '3': [1, 0, 1],
    '4': [1, 0, 0, 1],
    '1-typed': new Float32Array([1]),
    '2-typed': new Float32Array([1, 1]),
    '3-typed': new Float32Array([1, 0, 1]),
    '4-typed': new Float32Array([1, 0, 0, 1]),
    'zero': 0
  }

  var propDesc = extend({}, baseDesc)
  propDesc.attributes = extend(propDesc.attributes, {
    color: {
      constant: regl.prop('color')
    }
  })
  var propCommand = regl(propDesc)

  var propDynShaderDesc = extend({
    frag: function (context, props) {
      return frag
    }
  }, baseDesc)
  propDynShaderDesc.attributes = extend(propDynShaderDesc.attributes, {
    color: {
      constant: regl.prop('color')
    }
  })
  var propDynShaderCommand = regl(propDynShaderDesc)

  var propAttrDesc = extend({}, baseDesc)
  propAttrDesc.attributes = extend(propAttrDesc.attributes, {
    color: function (_, props) {
      return {
        constant: props.color
      }
    }
  })
  var propAttrCommand = regl(propAttrDesc)

  var propAttrDynDesc = extend({
    frag: function (context, props) {
      return frag
    }
  }, baseDesc)
  propAttrDynDesc.attributes = extend(propAttrDynDesc.attributes, {
    color: function (_, props) {
      return {
        constant: props.color
      }
    }
  })
  var propAttrDynCommand = regl(propAttrDynDesc)

  var commands = {
    'static': function (color) {
      var desc = extend({}, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: {
          constant: color
        }
      })
      return regl(desc)
    },

    'static - dyn shader': function (color) {
      var desc = extend({
        frag: function (context, props) {
          return frag
        }
      }, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: {
          constant: color
        }
      })
      return regl(desc)
    },

    'prop': function (color) {
      return propCommand
    },

    'prop - dyn shader': function (color) {
      return propDynShaderCommand
    },

    'context': function (color) {
      var desc = extend({
        context: {
          color: color
        }
      }, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: {
          constant: regl.context('color')
        }
      })
      return regl(desc)
    },

    'context - dyn shader': function (color) {
      var desc = extend({
        context: {
          color: color
        },
        frag: function () {
          return frag
        }
      }, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: {
          constant: regl.context('color')
        }
      })
      return regl(desc)
    },

    'prop-attr': function (color) {
      return propAttrCommand
    },

    'prop-attr - dyn shader': function (color) {
      return propAttrDynCommand
    },

    'context-attr': function (color) {
      var desc = extend({
        context: {
          color: {
            constant: color
          }
        }
      }, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: regl.context('color')
      })
      return regl(desc)
    },

    'context-attr - dyn shader': function (color) {
      var desc = extend({
        context: {
          color: {
            constant: color
          }
        },
        frag: function () {
          return frag
        }
      }, baseDesc)
      desc.attributes = extend(desc.attributes, {
        color: regl.context('color')
      })
      return regl(desc)
    }
  }

  var cases = {
    'draw': function (command, color) {
      command({ color: color })
    },
    'batch': function (command, color) {
      command([{color: color}])
    },
    'scope': function (command, color) {
      command({color: color}, function () {
        regl.draw()
      })
    },
    'scope - batch': function (command, color) {
      command({color: color}, function () {
        regl.draw(1)
      })
    }
  }

  function checkPixels (color) {
    var pixels = regl.read()
    for (var i = 0; i < 2 * 2; ++i) {
      if (typeof color === 'number') {
        if (pixels[4 * i] !== color * 255) {
          return false
        }
        if (pixels[4 * i + 1] !== 0 ||
            pixels[4 * i + 2] !== 0 ||
            pixels[4 * i + 3] !== 0) {
          return false
        }
      } else {
        for (var j = 0; j < color.length; ++j) {
          if (pixels[4 * i + j] !== color[j] * 255) {
            return false
          }
        }
        for (j = color.length; j < 4; ++j) {
          if (pixels[4 * i + j] !== 0) {
            return false
          }
        }
      }
    }
    return true
  }

  Object.keys(colors).forEach(function (count) {
    var color = colors[count]
    Object.keys(commands).forEach(function (commandName) {
      var genCommand = commands[commandName]
      var command = genCommand(color)
      Object.keys(cases).forEach(function (caseName) {
        var caseCode = cases[caseName]
        regl.clear({
          color: [1, 1, 1, 1]
        })
        caseCode(command, color)
        t.ok(checkPixels(color), caseName + ',' + commandName + ' ' + count)
        if (commandName.indexOf('prop') >= 0 && Array.isArray(color)) {
          for (var i = 0; i < color.length; ++i) {
            var scratchColor = color.slice()
            scratchColor[i] = color[i] ^ 1
            regl.clear({
              color: [0, 0, 0, 0]
            })
            caseCode(command, scratchColor)
            t.ok(checkPixels(scratchColor), caseName + ',' + commandName + ' ' + count)
          }
        }
      })
    })
  })

  regl.destroy()
  createContext.destroy(gl)
  t.end()
})
