/* jshint esnext: true */

export default function Display() {
  var $root = $('.notices'),
      $message = $root.find('.message');

  return Object.create({}, {
    active: {
      set: function(active){
        var ACTIVE = "active";
        if (active) {
          $root.addClass(ACTIVE);
        } else {
          $root.removeClass(ACTIVE);
        }
      },
      enumerable: true
    },
    message: {
      set: function(message){
        $message.html(message);
      }
    }
  });
}
