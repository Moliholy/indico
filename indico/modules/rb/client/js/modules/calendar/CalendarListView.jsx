// This file is part of Indico.
// Copyright (C) 2002 - 2024 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import LazyScroll from 'redux-lazy-scroll';
import {
  Button,
  Card,
  Confirm,
  Divider,
  Header,
  Icon,
  Label,
  Message,
  Popup,
} from 'semantic-ui-react';

import * as linkingSelectors from 'indico/modules/rb/common/linking/selectors';
import {TooltipIfTruncated} from 'indico/react/components';
import {Param, Translate} from 'indico/react/i18n';

import {actions as bookingsActions} from '../../common/bookings';
import CardPlaceholder from '../../components/CardPlaceholder';

import * as calendarActions from './actions';
import * as calendarSelectors from './selectors';

import './CalendarListView.module.scss';

const ACTIVE_BOOKINGS_LIMIT = 40;

class CalendarListView extends React.Component {
  static propTypes = {
    bookings: PropTypes.object.isRequired,
    rowsLeft: PropTypes.number.isRequired,
    isFetchingActiveBookings: PropTypes.bool.isRequired,
    roomFilters: PropTypes.object.isRequired,
    calendarFilters: PropTypes.object.isRequired,
    datePicker: PropTypes.object.isRequired,
    linkData: PropTypes.object.isRequired,
    actions: PropTypes.exact({
      openBookingDetails: PropTypes.func.isRequired,
      linkBookingOccurrence: PropTypes.func.isRequired,
      fetchActiveBookings: PropTypes.func.isRequired,
      clearActiveBookings: PropTypes.func.isRequired,
    }).isRequired,
  };

  state = {
    linkingConfirmOpen: false,
  };

  componentDidMount() {
    const {
      actions: {fetchActiveBookings},
    } = this.props;
    fetchActiveBookings(ACTIVE_BOOKINGS_LIMIT);
  }

  componentDidUpdate(prevProps) {
    const {
      datePicker: {selectedDate: prevDate, mode: prevMode},
      roomFilters: prevRoomFilters,
      calendarFilters: prevCalendarFilters,
    } = prevProps;
    const {
      datePicker: {selectedDate, mode},
      roomFilters,
      calendarFilters,
    } = this.props;

    const roomFiltersChanged = !_.isEqual(prevRoomFilters, roomFilters);
    const calendarFiltersChanged = !_.isEqual(prevCalendarFilters, calendarFilters);
    if (
      prevDate !== selectedDate ||
      mode !== prevMode ||
      roomFiltersChanged ||
      calendarFiltersChanged
    ) {
      this.refetchActiveBookings(roomFiltersChanged);
    }
  }

  componentWillUnmount() {
    const {
      actions: {clearActiveBookings},
    } = this.props;
    clearActiveBookings();
  }

  refetchActiveBookings(roomFiltersChanged) {
    const {
      actions: {fetchActiveBookings, clearActiveBookings},
    } = this.props;
    clearActiveBookings();
    fetchActiveBookings(ACTIVE_BOOKINGS_LIMIT, roomFiltersChanged);
  }

  fetchMoreBookings = () => {
    const {
      actions: {fetchActiveBookings},
    } = this.props;
    fetchActiveBookings(ACTIVE_BOOKINGS_LIMIT, false);
  };

  renderDayBookings = (day, bookings, linkData) => {
    if (!bookings.length) {
      return null;
    }

    return (
      <div styleName="day-cards" key={day}>
        <Header styleName="day-cards-header" dividing>
          <Icon name="calendar outline" />
          {moment(day, 'YYYY-MM-DD').format('dddd, LL')}
        </Header>
        <Card.Group itemsPerRow={4} stackable styleName="day-cards-container">
          {bookings.map(booking => this.renderBooking(booking, day, linkData))}
        </Card.Group>
        <Divider hidden />
      </div>
    );
  };

  renderLink = (booking, day, linkData, linkBookingOccurrence) => {
    if (linkData) {
      const {linkingConfirmOpen} = this.state;
      const {reservation} = booking;
      const boundaries = [moment(linkData.startDt), moment(linkData.endDt)];
      const datesMatch =
        moment(booking.startDt).isBetween(...boundaries, undefined, '[]') &&
        moment(booking.endDt).isBetween(...boundaries, undefined, '[]');
      if (!!booking.link || !datesMatch) {
        return;
      }
      const linkBtn = (
        <Button
          icon={<Icon name="linkify" />}
          primary
          size="small"
          circular
          onClick={e => {
            e.stopPropagation();
            this.setState({linkingConfirmOpen: true});
          }}
        />
      );
      return (
        <>
          <Confirm
            size="mini"
            header={Translate.string('Link event')}
            open={linkingConfirmOpen}
            content={Translate.string('Are you sure you want to link this event?')}
            closeOnDimmerClick
            closeOnEscape
            onClose={e => {
              e.stopPropagation();
              this.setState({linkingConfirmOpen: false});
            }}
            onConfirm={e => {
              e.stopPropagation();
              this.setState({linkingConfirmOpen: false});
              linkBookingOccurrence(reservation.id, day, linkData.id, () =>
                this.refetchActiveBookings(false)
              );
            }}
            onCancel={e => {
              e.stopPropagation();
              this.setState({linkingConfirmOpen: false});
            }}
            onOpen={e => e.stopPropagation()}
            cancelButton={<Button content={Translate.string('Cancel')} />}
            confirmButton={<Button content={Translate.string('Link')} />}
            closeIcon
          />
          <div style={{position: 'absolute', top: '35%', right: '5px'}}>
            <Popup trigger={linkBtn} position="bottom center">
              <Translate>
                Link to <Param name="bookedFor" value={linkData.title} />
              </Translate>
            </Popup>
          </div>
        </>
      );
    }
  };

  renderBooking = (booking, day, linkData) => {
    const {
      actions: {openBookingDetails, linkBookingOccurrence},
    } = this.props;
    const {reservation} = booking;
    const {room, isAccepted} = reservation;
    const key = `${reservation.id}-${booking.startDt}-${booking.endDt}`;
    const startTime = moment(booking.startDt, 'YYYY-MM-DD HH:mm').format('LT');
    const endTime = moment(booking.endDt, 'YYYY-MM-DD HH:mm').format('LT');
    return (
      <Card styleName="booking-card" key={key} onClick={() => openBookingDetails(reservation.id)}>
        <Card.Content>
          <Card.Header>
            {!isAccepted && (
              <Popup
                trigger={<Label color="yellow" icon="clock" corner="right" size="tiny" />}
                content={Translate.string('This booking is pending confirmation by the room owner')}
                position="right center"
              />
            )}
            <TooltipIfTruncated>
              <div styleName="booking-card-header">{room.fullName}</div>
            </TooltipIfTruncated>
          </Card.Header>
          <Card.Meta>
            {startTime} - {endTime}
          </Card.Meta>
          <Card.Description>{reservation.bookingReason}</Card.Description>
        </Card.Content>
        <Card.Content extra>
          <TooltipIfTruncated>
            <div styleName="booking-booked-for">
              <Translate>
                Booked for <Param name="bookedFor" value={reservation.bookedForName} />
              </Translate>
            </div>
          </TooltipIfTruncated>
          {booking.link && (
            <TooltipIfTruncated>
              <div styleName="booking-booked-for">
                <Translate>
                  Linked to{' '}
                  <Param
                    name="linkedTo"
                    value={booking.link.object.title}
                    wrapper={<a href={booking.link.object.url} target="_blank" rel="noreferrer" />}
                  />
                </Translate>
              </div>
            </TooltipIfTruncated>
          )}
        </Card.Content>
        {this.renderLink(booking, day, linkData, linkBookingOccurrence)}
      </Card>
    );
  };

  render() {
    const {bookings, rowsLeft, isFetchingActiveBookings, linkData} = this.props;
    const sortedEntries = _.sortBy(Object.entries(bookings), item => item[0]);
    const hasData = Object.keys(sortedEntries).length !== 0;

    return (
      <div styleName="active-bookings">
        {(isFetchingActiveBookings || hasData) && (
          <LazyScroll
            hasMore={rowsLeft > 0}
            loadMore={this.fetchMoreBookings}
            isFetching={isFetchingActiveBookings}
          >
            {sortedEntries.map(bookingsData => this.renderDayBookings(...bookingsData, linkData))}
            {isFetchingActiveBookings && (
              <CardPlaceholder.Group
                count={ACTIVE_BOOKINGS_LIMIT}
                itemsPerRow={4}
                withImage={false}
              />
            )}
          </LazyScroll>
        )}
        {!isFetchingActiveBookings && !hasData && (
          <Message info>
            <Translate>There are no bookings matching the criteria.</Translate>
          </Message>
        )}
      </div>
    );
  }
}

export default connect(
  state => ({
    bookings: calendarSelectors.getActiveBookings(state),
    rowsLeft: calendarSelectors.getNumberOfRowsLeft(state),
    isFetchingActiveBookings: calendarSelectors.isFetchingActiveBookings(state),
    roomFilters: calendarSelectors.getRoomFilters(state),
    calendarFilters: calendarSelectors.getCalendarFilters(state),
    datePicker: calendarSelectors.getDatePickerInfo(state),
    linkData: linkingSelectors.getLinkObject(state),
  }),
  dispatch => ({
    actions: bindActionCreators(
      {
        openBookingDetails: bookingsActions.openBookingDetails,
        linkBookingOccurrence: bookingsActions.linkBookingOccurrence,
        fetchActiveBookings: calendarActions.fetchActiveBookings,
        clearActiveBookings: calendarActions.clearActiveBookings,
      },
      dispatch
    ),
  })
)(CalendarListView);
