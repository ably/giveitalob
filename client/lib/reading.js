/* jshint esnext: true */

function isRational() {
  for (var i = 0; i < arguments.length; i++) {
    var val = arguments[i];
    if (typeof val !== "number"){
      return false;
    }
    if (!isFinite(val)) {
      return false;
    }
  }
  return true;
}

function roundtoFour(number) {
  return parseFloat(number.toFixed(4));
}

export default function Reading(raw){
  if ( !(this instanceof Reading) ) { return new Reading(raw); }

  this.x = raw.x;
  this.y = raw.y;
  this.z = raw.z;
  this.timestamp = raw.timestamp;

  if (!isRational(this.x, this.y, this.z, this.timestamp)) {
    throw new TypeError("Reading should have numerical values for x, y, z & timestamp");
  }
}

Object.defineProperty(Reading.prototype, "magnitude", {
  get: function(){
    return roundtoFour(Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z));
  }
});

Reading.prototype.asJson = function() {
  return {
    timestamp: this.timestamp,
    magnitude: this.magnitude
  }
};
