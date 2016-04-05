export default function Phone() {
  if ( !(this instanceof Phone) ) { return new Phone(); }
  var $phone = document.documentElement.querySelector('#tridiv .scene');
  var prefixes = ["-webkit-", "-moz-", "-ms-", ""];

  this.setOrientation = function(position) {
    var landscape = false;

    if ((position.orientation == 90) || (position.orientation == -90)) {
      landscape = true;
    }

    /* Don't rotate on Y axis so that phone rotates on X & Y axis in front of user */
    var xRotation = (90 - position.beta) + 270,
        yRotation = landscape ? 90 : 0,
        zRotation = position.gamma;

    var cssText = '';

    for (var prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex++) {
      var prefix = prefixes[prefixIndex];
      cssText += prefix + 'transform: rotateX(' + xRotation + 'deg) rotateY(' + yRotation + 'deg) rotateZ(' + zRotation + 'deg);';
    }

    $phone.style.cssText = cssText;
  }
}
