import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import Segment from '../segments/Segment'
import uuid from 'uuid'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { TILE_SIZE } from '../segments/constants'
import { getVariantArray } from '../segments/variant_utils'
import { cancelSegmentResizeTransitions } from '../segments/resizing'

class StreetEditable extends React.Component {
  static propTypes = {
    onResized: PropTypes.bool.isRequired,
    setBuildingWidth: PropTypes.func.isRequired,
    street: PropTypes.object.isRequired,
    updatePerspective: PropTypes.func.isRequired
  }

  constructor (props) {
    super(props)

    this.state = {
      suppressMouseEnter: false
    }
  }

  componentDidUpdate (prevProps) {
    const { onResized } = this.props

    if (onResized && prevProps.onResized !== onResized) {
      this.props.setBuildingWidth(this.streetSectionEditable)
    }

    if (prevProps.street.id !== this.props.street.id || prevProps.street.width !== this.props.street.width) {
      cancelSegmentResizeTransitions()
    }
  }

  updateSegmentData = (ref, dataNo, segmentPos) => {
    const { segments } = this.props.street
    const segment = segments[dataNo]

    if (segment) {
      segment.el = ref
      segment.el.dataNo = dataNo
      segment.el.savedLeft = Math.round(segmentPos)
      segment.el.savedNoMoveLeft = Math.round(segmentPos)
      segment.el.cssTransformLeft = Math.round(segmentPos)
      segment.el.savedWidth = Math.round(segment.width * TILE_SIZE)
    }
  }

  switchSegmentAway = (el) => {
    el.classList.add('create')
    el.style.left = el.savedLeft + 'px'

    this.props.updatePerspective(el)
    this.setState({ suppressMouseEnter: true })
  }

  calculateSegmentPos = (dataNo) => {
    const { segments, remainingWidth } = this.props.street
    let currPos = remainingWidth / 2

    for (let i = 0; i < dataNo; i++) {
      currPos += segments[i].width
    }

    return (currPos * TILE_SIZE)
  }

  handleExitAnimations = (child) => {
    return React.cloneElement(child, {
      exit: !(this.props.street.immediateRemoval)
    })
  }

  renderStreetSegments = () => {
    const { segments, units, immediateRemoval } = this.props.street

    return segments.map((segment, i) => {
      const segmentWidth = (segment.width * TILE_SIZE)
      const segmentPos = this.calculateSegmentPos(i)

      segment.variant = getVariantArray(segment.type, segment.variantString)
      segment.warnings = (segment.warnings) || []

      if (!segment.id) {
        segment.id = uuid()
      }

      const segmentEl = (
        <CSSTransition
          key={segment.id}
          timeout={250}
          classNames="switching-away"
          exit={!(immediateRemoval)}
          onExit={this.switchSegmentAway}
          onExited={() => { this.setState({ suppressMouseEnter: false }) }}
          unmountOnExit
        >
          <Segment
            key={segment.id}
            dataNo={i}
            type={segment.type}
            variantString={segment.variantString}
            width={segmentWidth}
            isUnmovable={false}
            forPalette={false}
            units={units}
            randSeed={segment.randSeed}
            segmentPos={segmentPos}
            suppressMouseEnter={this.state.suppressMouseEnter}
            updateSegmentData={this.updateSegmentData}
            updatePerspective={this.props.updatePerspective}
          />
        </CSSTransition>
      )

      return segmentEl
    })
  }

  render () {
    const style = {
      width: (this.props.street.width * TILE_SIZE) + 'px'
    }

    return (
      <div
        id="street-section-editable"
        key={this.props.street.id}
        style={style}
        ref={(ref) => { this.streetSectionEditable = ref }}
      >
        <TransitionGroup key={this.props.street.id} component={null} enter={false} childFactory={this.handleExitAnimations}>
          {this.renderStreetSegments()}
        </TransitionGroup>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    street: state.street
  }
}

export default connect(mapStateToProps)(StreetEditable)
