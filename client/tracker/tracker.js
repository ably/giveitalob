/* jshint esnext: true */

import { Config } from '../config';

import State from "./state";
import Audio from "../lib/Audio";

function lastInArray(array){
  return array[array.length - 1];
}

function lastNInArray(n, array){
  return array.slice(Math.max(array.length - n, 0));
}

var TRACKER_INVALID_STATE_MESSAGE = "Tracker did not receive valid initial state";

/***
  The tracker application has an internal state.
  All observers know that the can watch a given projection of that state
  project and present overloaded verbs.
  options showcase or exhibit
  function showcase(state){
    // The tracker just cares that its state is shown somewhere
    tracker.showcase.dispatch(state);
***/

function Tracker(state, world){
  if ( !(this instanceof Tracker) ) { return new Tracker(state, world); }
  try {
    state = State(state || {});
  } catch (e) {
    // alert(e); DEBT throws in tests
    throw new TypeError(TRACKER_INVALID_STATE_MESSAGE);
    // return; // Will be needed if we move the error handling to logger
  }
  var tracker = this;
  tracker.state = state;
  // DEBT return to external assignment
  world = world || {};
  tracker.logger = world.logger // Or error causing of silent version;

  tracker.audio = new Audio();

  tracker.uplinkAvailable = function(channelName){
    // Set state action can cause projection to exhibit new state
    tracker.state = tracker.state.set("uplinkStatus", "AVAILABLE");
    tracker.state = tracker.state.set("uplinkChannelName", channelName);
    // call log change. test listeners that the state has changed.
    tracker.logger.info("Uplink available on channel:", channelName);
    showcase(tracker.state);
  };

  tracker.uplinkPresent = function(channelName, publishingMembers){
    if (publishingMembers.length === 0) {
      this.uplinkAvailable(channelName);
    } else {

      var deviceDescriptions = publishingMembers.filter(function(member) {
        return member.data.device;
      }).map(function(member) {
        return member.data.device;
      });

      if (tracker.state.uplinkStatus !== 'STREAMING') {
        tracker.state = tracker.state.set("uplinkStatus", "STREAMING");
        tracker.state = tracker.state.set("uplinkChannelName", channelName);
        tracker.state = tracker.state.set("uplinkDevice", deviceDescriptions[0]);
        tracker.logger.info("Uplink streaming", channelName);
        showcase(tracker.state);
      }
    }
  };

  tracker.uplinkFailed = function(err ){
    console.error(err);
    var state = tracker.state.set("uplinkStatus", "FAILED");
    tracker.state = state.set("alert", "Could not connect to Ably realtime service. Please try again later");
    tracker.logger.error("Uplink failed to connect", err);
    showcase(tracker.state);
  };

  tracker.uplinkDisconnected = function(err) {
    if (tracker.state.uplinkStatus === 'DISCONNECTED') { return; }
    tracker.state = tracker.state.set("uplinkStatus", "DISCONNECTED");
    tracker.logger.warn("Uplink has been disconnected", err);
    showcase(tracker.state);
  };

  tracker.newReading = function(newReading){
    tracker.showcase.addReading(newReading);
  };

  tracker.newFlight = function(flightData, live) {
    this.showcase.addFlight(flightData, live);
    if (live) { this.audio.playDropSound(); };
  }

  tracker.newOrientation = function(position){
    tracker.showcase.orientatePhones(position);
  };

  tracker.closeAlert = function(){
    tracker.state = tracker.state.set("alert", "");
    showcase(tracker.state);
  };

  function showcase(state) {
    tracker.showcase.update(state);
  }
}

export default Tracker;
