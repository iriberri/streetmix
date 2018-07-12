import React from 'react'
import { FormattedMessage, injectIntl, intlShape } from 'react-intl'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Menu from './Menu'

import { FACEBOOK_APP_ID } from '../app/config'
import { trackEvent } from '../app/event_tracking'
import { getPageTitle } from '../app/page_title'
import { printImage } from '../app/print'
import { getSharingUrl } from '../util/share_url'
import { showDialog } from '../store/actions/dialogs'

export class ShareMenu extends React.Component {
  static propTypes = {
    intl: intlShape,
    showDialog: PropTypes.func.isRequired,
    signedIn: PropTypes.bool.isRequired,
    userId: PropTypes.string,
    street: PropTypes.object
  }

  static defaultProps = {
    userId: ''
  }

  constructor (props) {
    super(props)

    this.state = {
      shareUrl: ''
    }
  }

  componentDidMount () {
    this.updateLinks()
  }

  updateLinks = () => {
    const url = getSharingUrl()

    this.setState({ shareUrl: url })
  }

  getSharingMessage = () => {
    const street = this.props.street
    let message = ''

    if (street.creatorId) {
      if (this.props.signedIn && street.creatorId === this.props.userId) {
        if (street.name) {
          message = this.formatSharingMessage('menu.share.messages.my-street', 'Check out my street, {streetName}, on Streetmix!', { streetName: street.name })
        } else {
          message = this.formatSharingMessage('menu.share.messages.my-street-unnamed', 'Check out my street on Streetmix!')
        }
      } else {
        if (street.name) {
          message = this.formatSharingMessage('menu.share.messages.someone-elses-street', 'Check out {streetName} by {streetCreator} on Streetmix!', { streetName: street.name, streetCreator: `@${street.creatorId}` })
        } else {
          message = this.formatSharingMessage('menu.share.messages.someone-elses-street-unnamed', 'Check out this street by {streetCreator} on Streetmix!', { streetCreator: `@${street.creatorId}` })
        }
      }
    } else {
      if (street.name) {
        message = this.formatSharingMessage('menu.share.messages.anonymous-creator-street', 'Check out {streetName} on Streetmix!', { streetName: street.name })
      } else {
        message = this.formatSharingMessage('menu.share.messages.anonymous-creator-street-unnamed', 'Check out this street on Streetmix!')
      }
    }

    return message
  }

  /**
   * Wrapper around props.intl.formatMessage
   *
   * @param {string} key
   * @param {string} defaultMsg - default message (fallback)
   * @param {Object} values - object of values to replace
   * @returns {string}
   */
  formatSharingMessage = (key, defaultMsg, values = {}) => {
    return this.props.intl.formatMessage({
      id: key,
      defaultMessage: defaultMsg
    }, values)
  }

  onShow = () => {
    // Make sure links are updated when the menu is opened
    this.updateLinks()

    // Auto-focus and select link when share menu is active
    window.setTimeout(() => {
      this.shareViaLinkInput.focus()
      this.shareViaLinkInput.select()
    }, 200)
  }

  onClickShareViaTwitter () {
    trackEvent('SHARING', 'TWITTER', null, null, false)
  }

  onClickShareViaFacebook () {
    trackEvent('SHARING', 'FACEBOOK', null, null, false)
  }

  onClickSaveAsImage = (event) => {
    event.preventDefault()
    this.props.showDialog('SAVE_AS_IMAGE')
  }

  onClickSignIn = (event) => {
    event.preventDefault()
    this.props.showDialog('SIGN_IN')
  }

  render () {
    const shareText = this.getSharingMessage()
    const twitterLink = 'https://twitter.com/intent/tweet' +
      '?text=' + encodeURIComponent(shareText) +
      '&url=' + encodeURIComponent(this.state.shareUrl)

    const facebookLink = 'https://www.facebook.com/dialog/feed' +
      '?app_id=' + encodeURIComponent(FACEBOOK_APP_ID) +
      '&redirect_uri=' + encodeURIComponent(this.state.shareUrl) +
      '&link=' + encodeURIComponent(this.state.shareUrl) +
      '&name=' + encodeURIComponent(getPageTitle(this.props.street)) +
      '&description=' + encodeURIComponent(shareText)

    const signInLink = <a onClick={this.onClickSignIn} href="#">
      <FormattedMessage
        defaultMessage="Sign in"
        id="menu.share.sign-in-twitter-link"
      />
    </a>

    const signInPromo = (!this.props.signedIn)
      ? (
        <div className="share-sign-in-promo">
          <FormattedMessage
            id="menu.share.sign-in-link"
            defaultMessage={`{signInLink} for nicer links to your streets and your personal street gallery`}
            values={{
              signInLink
            }}
          />
        </div>
      ) : null

    return (
      <Menu onShow={this.onShow} className="share-menu" {...this.props}>
        {signInPromo}
        <div className="share-via-link-container">
          <FormattedMessage id="menu.share.link" defaultMessage="Copy and paste this link to share:" />
          <input
            className="share-via-link"
            type="text"
            value={this.state.shareUrl}
            spellCheck="false"
            ref={(ref) => { this.shareViaLinkInput = ref }}
          />
        </div>
        <a
          className="share-via-twitter"
          href={twitterLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={this.onClickShareViaTwitter}
        >
          <FontAwesomeIcon icon={['fab', 'twitter']} />
          <FormattedMessage id="menu.share.twitter" defaultMessage="Share using Twitter" />
        </a>
        <a
          className="share-via-facebook"
          href={facebookLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={this.onClickShareViaFacebook}
        >
          <FontAwesomeIcon icon={['fab', 'facebook-square']} />
          <FormattedMessage id="menu.share.facebook" defaultMessage="Share using Facebook" />
        </a>
        <a href="#" onClick={printImage}>
          <FormattedMessage id="menu.share.print" defaultMessage="Print…" />
        </a>
        <a id="save-as-image" href="#" onClick={this.onClickSaveAsImage}>
          <FormattedMessage id="menu.share.save" defaultMessage="Save as image…" />
          <span className="menu-item-subtext">
            <FormattedMessage id="menu.share.save-byline" defaultMessage="For including in a report, blog, etc." />
          </span>
        </a>
      </Menu>
    )
  }
}

function mapStateToProps (state) {
  return {
    signedIn: state.user.signedIn,
    userId: state.user.signInData && state.user.signInData.userId,
    street: state.street
  }
}

function mapDispatchToProps (dispatch) {
  return {
    showDialog: (type) => { dispatch(showDialog(type)) }
  }
}

export default injectIntl(connect(mapStateToProps, mapDispatchToProps)(ShareMenu))
