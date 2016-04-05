/* jshint esnext: true */

import Struct from "../../node_modules/carbide/struct";

var STATE_DEFAULTS = {
  uplinkStatus: "UNKNOWN",
  uplinkChannelName: "UNKNOWN",
  uplinkDevice: null,
  flightSnapshot: null,
  alert: ""
};

function State(raw){
  if ( !(this instanceof State) ) { return new State(raw); }

  return Struct.call(this, STATE_DEFAULTS, raw);
}

State.prototype = Object.create(Struct.prototype);
State.prototype.constructor = State;

export default State;
