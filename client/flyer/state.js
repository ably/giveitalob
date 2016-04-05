import Struct from "../../node_modules/carbide/struct";

var FLYER_STATE_DEFAULTS = {
  uplinkStatus: "CONNECTING",
  uplinkDetails: {},
  latestReading: null, // DEBT best place a null object here
  currentFlight: [],
  flightHistory: [],
  alert: ""
};

// DEBT not quite sure why this can't just be named state;
export default function FlyerState(raw){
  if ( !(this instanceof FlyerState) ) { return new FlyerState(raw); }

  // DEBT with return statement is not an instance of FlyerState.
  // without return statement does not work at all.
  return Struct.call(this, FLYER_STATE_DEFAULTS, raw);
}

FlyerState.prototype = Object.create(Struct.prototype);
FlyerState.prototype.constructor = FlyerState;
