import { images } from '../app/load_resources'
import { t } from '../locales/locale'
import { system } from '../preinit/system_capabilities'
import { saveStreetToServerIfNecessary } from '../streets/data_model'
import { recalculateWidth } from '../streets/width'
import { draggingMove } from './drag_and_drop'
import { getSegmentInfo, getSegmentVariantInfo, getSpriteDef } from './info'
import { drawProgrammaticPeople } from './people'
import { TILE_SIZE, TILESET_POINT_PER_PIXEL, WIDTH_PALETTE_MULTIPLIER } from './constants'
import { applyWarningsToSegments } from './resizing'
import store from '../store'

const CANVAS_HEIGHT = 480
const CANVAS_GROUND = 35
const CANVAS_BASELINE = CANVAS_HEIGHT - CANVAS_GROUND

const SEGMENT_Y_NORMAL = 265
const SEGMENT_Y_PALETTE = 20

const DRAGGING_MOVE_HOLE_WIDTH = 40

/**
 * Draws SVG sprite to canvas
 *
 * @param {string} id - identifier of sprite
 * @param {CanvasRenderingContext2D} ctx
 * @param {Number} sx - x position of sprite to read from (default = 0)
 * @param {Number} sy - y position of sprite to read from (default = 0)
 * @param {Number} sw - sub-rectangle width to draw
 * @param {Number} sh - sub-rectangle height to draw
 * @param {Number} dx - x position on canvas
 * @param {Number} dy - y position on canvas
 * @param {Number} dw - destination width to draw
 * @param {Number} dh - destination height to draw
 * @param {Number} multiplier - scale to draw at (default = 1)
 * @param {Number} dpi
 */
export function drawSegmentImage (id, ctx, sx = 0, sy = 0, sw, sh, dx, dy, dw, dh, multiplier = 1, dpi) {
  // If asked to render a source or destination image with width or height
  // that is equal to or less than 0, bail. Attempting to render such an image
  // will throw an IndexSizeError error in Firefox.
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return

  // Settings
  const state = store.getState()
  dpi = dpi || state.system.hiDpi || 1
  const debugRect = state.flags.DEBUG_SEGMENT_CANVAS_RECTANGLES.value || false

  // Get image definition
  const svg = images.get(id)

  // Source width and height is based off of intrinsic image width and height,
  // but it can be overridden in the parameters, e.g. when repeating sprites
  // in a sequence and the last sprite needs to be truncated
  sw = (sw === undefined) ? svg.width : sw * TILESET_POINT_PER_PIXEL
  sh = (sh === undefined) ? svg.height : sh * TILESET_POINT_PER_PIXEL

  // We can't read `.naturalWidth` and `.naturalHeight` properties from
  // the image in IE11, which returns 0. This is why width and height are
  // stored as properties from when the image is first cached
  // All images are drawn at 2x pixel dimensions so divide in half to get
  // actual width / height value then multiply by system pixel density
  //
  // dw/dh (and later sw/sh) can be 0, so don't use falsy checks
  dw = (dw === undefined) ? svg.width / TILESET_POINT_PER_PIXEL : dw
  dh = (dh === undefined) ? svg.height / TILESET_POINT_PER_PIXEL : dh
  dw *= multiplier * dpi
  dh *= multiplier * dpi

  // Set render dimensions based on pixel density
  dx *= dpi
  dy *= dpi

  // These rectangles are telling us that we're drawing at the right places.
  if (debugRect === true) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(dx, dy, dw, dh)
  }

  try {
    ctx.drawImage(svg.img, sx, sy, sw, sh, dx, dy, dw, dh)
  } catch (e) {
    // IE11 has some issues drawing SVG images soon after loading. https://stackoverflow.com/questions/25214395/unexpected-call-to-method-or-property-access-while-drawing-svg-image-onto-canvas
    setTimeout(() => {
      console.error('drawImage failed for img id ' + id + ' with error: ' + e + ' - Retrying after 2 seconds')
      ctx.drawImage(svg.img, sx, sy, sw, sh, dx, dy, dw, dh)
    }, 2000)
  }
}

export function getVariantInfoDimensions (variantInfo, initialSegmentWidth, multiplier) {
  let newLeft, newRight
  var segmentWidth = initialSegmentWidth / TILE_SIZE / multiplier

  var center = segmentWidth / 2
  var left = center
  var right = center

  const graphics = variantInfo.graphics

  if (graphics.center) {
    const sprites = Array.isArray(graphics.center) ? graphics.center : [graphics.center]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])

      newLeft = center - (sprite.width / 2) + (sprite.offsetX || 0)
      newRight = center + (sprite.width / 2) + (sprite.offsetX || 0)

      if (newLeft < left) {
        left = newLeft
      }
      if (newRight > right) {
        right = newRight
      }
    }
  }

  if (graphics.left) {
    const sprites = Array.isArray(graphics.left) ? graphics.left : [graphics.left]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      newLeft = sprite.offsetX || 0
      newRight = sprite.width + (sprite.offsetX || 0)

      if (newLeft < left) {
        left = newLeft
      }
      if (newRight > right) {
        right = newRight
      }
    }
  }

  if (graphics.right) {
    const sprites = Array.isArray(graphics.right) ? graphics.right : [graphics.right]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      newLeft = (segmentWidth) - (sprite.offsetX || 0) - sprite.width
      newRight = (segmentWidth) - (sprite.offsetX || 0)

      if (newLeft < left) {
        left = newLeft
      }
      if (newRight > right) {
        right = newRight
      }
    }
  }

  if (graphics.repeat && graphics.repeat[0]) {
    newLeft = center - (segmentWidth / 2)
    newRight = center + (segmentWidth / 2)

    if (newLeft < left) {
      left = newLeft
    }
    if (newRight > right) {
      right = newRight
    }
  }

  return { left: left, right: right, center: center }
}

/**
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type
 * @param {string} variantString
 * @param {Number} segmentWidth - width in feet (not display width)
 * @param {Number} offsetLeft
 * @param {Number} offsetTop
 * @param {Number} randSeed
 * @param {Number} multiplier
 * @param {Boolean} palette
 * @param {Number} dpi
 */
export function drawSegmentContents (ctx, type, variantString, segmentWidth, offsetLeft, offsetTop, randSeed, multiplier, palette, dpi) {
  const variantInfo = getSegmentVariantInfo(type, variantString)
  const graphics = variantInfo.graphics
  const dimensions = getVariantInfoDimensions(variantInfo, segmentWidth, multiplier)
  const left = dimensions.left

  if (graphics.repeat) {
    const sprites = Array.isArray(graphics.repeat) ? graphics.repeat : [graphics.repeat]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      let width = sprite.width * TILE_SIZE
      const count = Math.floor((segmentWidth / (width * multiplier)) + 1)
      let repeatStartX

      if (left < 0) {
        repeatStartX = -left * TILE_SIZE
      } else {
        repeatStartX = 0
      }

      for (let i = 0; i < count; i++) {
        // remainder
        if (i === count - 1) {
          width = (segmentWidth / multiplier) - ((count - 1) * width)
        }

        drawSegmentImage(sprite.id, ctx, undefined, undefined, width, undefined,
          offsetLeft + ((repeatStartX + (i * sprite.width * TILE_SIZE)) * multiplier),
          offsetTop + (multiplier * TILE_SIZE * (sprite.offsetY || 0)),
          width, undefined, multiplier, dpi)
      }
    }
  }

  if (graphics.left) {
    const sprites = Array.isArray(graphics.left) ? graphics.left : [graphics.left]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      const x = 0 + ((-left + (sprite.offsetX || 0)) * TILE_SIZE * multiplier)

      drawSegmentImage(sprite.id, ctx, undefined, undefined, undefined, undefined,
        offsetLeft + x,
        offsetTop + (multiplier * TILE_SIZE * (sprite.offsetY || 0)),
        undefined, undefined, multiplier, dpi)
    }
  }

  if (graphics.right) {
    const sprites = Array.isArray(graphics.right) ? graphics.right : [graphics.right]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      const x = (-left + (segmentWidth / TILE_SIZE / multiplier) - sprite.width - (sprite.offsetX || 0)) * TILE_SIZE * multiplier

      drawSegmentImage(sprite.id, ctx, undefined, undefined, undefined, undefined,
        offsetLeft + x,
        offsetTop + (multiplier * TILE_SIZE * (sprite.offsetY || 0)),
        undefined, undefined, multiplier, dpi)
    }
  }

  if (graphics.center) {
    const sprites = Array.isArray(graphics.center) ? graphics.center : [graphics.center]

    for (let l = 0; l < sprites.length; l++) {
      const sprite = getSpriteDef(sprites[l])
      const center = dimensions.center
      const x = (center - (sprite.width / 2) - left - (sprite.offsetX || 0)) * TILE_SIZE * multiplier

      drawSegmentImage(sprite.id, ctx, undefined, undefined, undefined, undefined,
        offsetLeft + x,
        offsetTop + (multiplier * TILE_SIZE * (sprite.offsetY || 0)),
        undefined, undefined, multiplier, dpi)
    }
  }

  if (type === 'sidewalk') {
    drawProgrammaticPeople(ctx, segmentWidth / multiplier, offsetLeft - (left * TILE_SIZE * multiplier), offsetTop, randSeed, multiplier, variantString, dpi)
  }
}

export function setSegmentContents (el, type, variantString, segmentWidth, randSeed, palette, quickUpdate) {
  let canvasEl
  const variantInfo = getSegmentVariantInfo(type, variantString)

  var multiplier = palette ? (WIDTH_PALETTE_MULTIPLIER / TILE_SIZE) : 1
  var dimensions = getVariantInfoDimensions(variantInfo, segmentWidth, multiplier)

  var totalWidth = dimensions.right - dimensions.left

  var offsetTop = palette ? SEGMENT_Y_PALETTE : SEGMENT_Y_NORMAL

  if (!quickUpdate) {
    var hoverBkEl = document.createElement('div')
    hoverBkEl.classList.add('hover-bk')
  }

  if (!quickUpdate) {
    canvasEl = document.createElement('canvas')
    canvasEl.classList.add('image')
  } else {
    canvasEl = el.querySelector('canvas')
  }
  canvasEl.width = totalWidth * TILE_SIZE * system.hiDpi
  canvasEl.height = CANVAS_BASELINE * system.hiDpi
  canvasEl.style.width = (totalWidth * TILE_SIZE) + 'px'
  canvasEl.style.height = CANVAS_BASELINE + 'px'
  canvasEl.style.left = (dimensions.left * TILE_SIZE * multiplier) + 'px'

  var ctx = canvasEl.getContext('2d')

  drawSegmentContents(ctx, type, variantString, segmentWidth, 0, offsetTop, randSeed, multiplier, palette)

  if (!quickUpdate) {
    const removeEl = el.querySelector('canvas')
    if (removeEl) removeEl.remove()
    el.appendChild(canvasEl)

    const removeEl2 = el.querySelector('.hover-bk')
    if (removeEl2) removeEl2.remove()
    el.appendChild(hoverBkEl)
  }
}

export function getLocaleSegmentName (type, variantString) {
  const segmentInfo = getSegmentInfo(type)
  const variantInfo = getSegmentVariantInfo(type, variantString)
  const defaultName = variantInfo.name || segmentInfo.name
  const nameKey = variantInfo.nameKey || segmentInfo.nameKey
  const key = `segments.${nameKey}`

  return t(key, defaultName, { ns: 'segment-info' })
}

export function repositionSegments () {
  let width, el
  var left = 0
  var noMoveLeft = 0

  const street = store.getState().street
  for (let i in street.segments) {
    el = street.segments[i].el

    if (el === draggingMove.segmentBeforeEl) {
      left += DRAGGING_MOVE_HOLE_WIDTH

      if (!draggingMove.segmentAfterEl) {
        left += DRAGGING_MOVE_HOLE_WIDTH
      }
    }

    if (el.classList.contains('dragged-out')) {
      width = 0
    } else {
      width = parseFloat(el.getAttribute('data-width')) * TILE_SIZE
    }

    el.savedLeft = Math.round(left) // so we don’t have to use offsetLeft
    el.savedNoMoveLeft = Math.round(noMoveLeft) // so we don’t have to use offsetLeft
    el.savedWidth = Math.round(width)

    left += width
    noMoveLeft += width

    if (el === draggingMove.segmentAfterEl) {
      left += DRAGGING_MOVE_HOLE_WIDTH

      if (!draggingMove.segmentBeforeEl) {
        left += DRAGGING_MOVE_HOLE_WIDTH
      }
    }
  }

  var occupiedWidth = left
  var noMoveOccupiedWidth = noMoveLeft

  var mainLeft = Math.round(((street.width * TILE_SIZE) - occupiedWidth) / 2)
  var mainNoMoveLeft = Math.round(((street.width * TILE_SIZE) - noMoveOccupiedWidth) / 2)

  for (let i in street.segments) {
    el = street.segments[i].el

    el.savedLeft += mainLeft
    el.savedNoMoveLeft += mainNoMoveLeft

    if (system.cssTransform) {
      el.style[system.cssTransform] = 'translateX(' + el.savedLeft + 'px)'
      el.cssTransformLeft = el.savedLeft
    } else {
      el.style.left = el.savedLeft + 'px'
    }
  }
}

/**
 * TODO: remove this
 */
export function segmentsChanged () {
  recalculateWidth()
  applyWarningsToSegments()
  saveStreetToServerIfNecessary()
}

/**
 * Given the position of a segment or building, retrieve a reference to its
 * DOM element.
 *
 * @param {Number|string} position - either "left" or "right" for building,
 *              or a number for the position of the segment. Should be
 *              the `dataNo` or `position` variables.
 */
export function getSegmentEl (position) {
  if (!position && position !== 0) return

  let segmentEl
  if (position === 'left') {
    segmentEl = document.querySelectorAll('.street-section-building')[0]
  } else if (position === 'right') {
    segmentEl = document.querySelectorAll('.street-section-building')[1]
  } else {
    const segments = document.getElementById('street-section-editable').querySelectorAll('.segment')
    segmentEl = segments[position]
  }
  return segmentEl
}
