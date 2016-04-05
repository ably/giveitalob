export default function Device() {
  if ( !(this instanceof Device) ) { return new Device(); }

  var mobileDetect = new MobileDetect(window.navigator.userAgent);
  var browser = platform;

  function mobileDescription() {
    if (mobileDetect.phone() && (mobileDetect.phone() !== 'UnknownPhone')) {
      return mobileDetect.phone()
    } else if (mobileDetect.tablet() && (mobileDetect.tablet() !== 'UnknownTablet')) {
      return mobileDetect.tablet();
    } else {
      return platform.os.family;
    }
  }

  function desktopDescription() {
    return browser.os.family.replace(/Windows.*/,"Windows") + " desktop";
  }

  this.deviceDescription = function() {
    if (mobileDetect.mobile()) {
      return mobileDescription();
    } else {
      return desktopDescription();
    }
  }
}
