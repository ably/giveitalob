export default function Audio() {
  if ( !(this instanceof Audio) ) { return new Audio(); }

  ion.sound({
    sounds: [{ name: "pop_cork" }],
    volume: 1,
    path: "/images/audio/",
    preload: true
  });

  this.playDropSound = function() {
    ion.sound.play("pop_cork");
  }
}
