/* jshint esnext: true */

import AlertDisplay from "../../alert/display";
import Device from "../../lib/device";

/* This function class contains the logic for the presentation
   messaging in the view based on the state, but is weirdly not a
   view itself as their is a view, a projection, and a presenter? */

function Display($root){
  var $leaderboardPanel = $root.find(".leaderboard"),
      $leaderboardSubmitPanel = $leaderboardPanel.find(".submit-panel"),
      $leaderboardSubmittedPanel = $leaderboardPanel.find(".submitted-panel"),
      $leaderboardForm = $leaderboardPanel.find("form"),
      $leaderBoardFormNickname = $leaderboardPanel.find("form input[name=nickname]"),
      $leaderBoardFormAltitude = $leaderboardPanel.find("form input[name=max-altitude]"),
      $leaderBoardFormFlightTime = $leaderboardPanel.find("form input[name=max-flight-time]"),
      $leaderBoardAltitudeMessage = $leaderboardPanel.find(".max-altitude-message"),
      $leaderBoardSubmittedAltitude = $leaderboardPanel.find(".max-altitude-message-submitted");

  var $message = $root.find(".message"),
      $uplinkStatus = $root.find(".uplink-status"),
      $loader = $root.find(".connecting-loader"),
      $connectionActive = $root.find(".connection-active");

  var alertDisplay = AlertDisplay();

  var deviceType = new Device().deviceDescription();

  function init() {
    $leaderboardForm.on('submit', function(event) {
      event.preventDefault();

      var altitude = $leaderBoardFormAltitude.val(),
          flightTime = $leaderBoardFormFlightTime.val(),
          nickname = $leaderBoardFormNickname.val().replace(/^\s+|\s+$/g,""),
          data = {
            "max-altitude": altitude,
            "max-flight-time": flightTime,
            "nickname": nickname,
            "device": deviceType
          };

      if (nickname.length === 0) {
        alert("Sorry, you need to have a nickname to enter the leaderboard");
        $leaderBoardFormNickname.focus();
        return;
      }

      if (window.localStorage) {
        localStorage.setItem('nickname', nickname);
      }

      $leaderboardForm.find('submit').attr('disabled', 'disabled');

      $.post('/submit-flight', data).done(function() {
          alertDisplay.active = false;
          $leaderBoardSubmittedAltitude.text(altitude + "m");
          $leaderboardSubmitPanel.hide();
          $leaderboardSubmittedPanel.show();
        }).fail(function() {
          alertDisplay.message = "Oops, something went wrong submitting your lob to the leaderboard. Please try again";
          alertDisplay.active = true;
        }).always(function() {
          $leaderboardForm.find('submit').removeAttr('disabled');
        })
    });
  }

  function setLoading(isLoading) {
    if (isLoading) {
      $loader.show();
      $connectionActive.hide();
    } else {
      $loader.hide();
      $connectionActive.show();
    }
  }

  function showLeaderboard(altitude, flightTime) {
    $leaderboardPanel.show();
    $leaderboardSubmitPanel.show();
    $leaderboardSubmittedPanel.hide();
    $leaderBoardFormAltitude.val(altitude);
    $leaderBoardFormFlightTime.val(flightTime);
    $leaderBoardAltitudeMessage.text(Math.round(altitude * 100)/100 + "m");

    if (window.localStorage && window.localStorage.getItem('nickname')) {
      $leaderBoardFormNickname.val(window.localStorage.getItem('nickname'));
    }
  }

  function updateUplinkStatus(presentation) {
    switch(presentation.uplinkStatus.toLowerCase()) {
      case "connecting":
        $uplinkStatus.html("Hold on, we're establishing a realtime connection to stream your lob.");
        setLoading(true);
        break;
      case "disconnected":
        $uplinkStatus.html("Hold on, we've lost the realtime connection. Trying to reconnect now.");
        setLoading(true);
        break;
      case "failed":
        $uplinkStatus.html("Oops, we've failed to establish a realtime connection. Try reloading this app.");
        setLoading(true);
        break;
      case "incompatible":
        $uplinkStatus.html("Unfortunately no accelerometer was found on this device. Please try again on a different mobile");
        setLoading(true);
        break;
      case "transmitting":
        $uplinkStatus.html("<p class='title-with-hint'>Your unique Lob code is: <b>" + presentation.channelName + "</b></p>" +
          "<p class='hint'>Give this to others and they can watch your Lob live.<br><a href='/why-stream'>How does this work?</a>");
        setLoading(false);
        break;
      default:
        console.error('Unknown status', status);
    }
  }

  function renderNoThrows(presentation) {
    $message.html("<p>Are you ready?</p><p><b>Lob your phone in the air now.</b></p><p>Good luck!</p>");
    updateUplinkStatus(presentation);
  }

  function renderFirstThrow(presentation) {
    $message.html("<p>Great throw!</p>" +
      "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
      "<p>Go on, try again!</p>");
    updateUplinkStatus(presentation);
  }

  function renderMultipleThrows(presentation) {
    if (presentation.lastHigherThanBefore) {
      $message.html("<p>Superb, <b>that's your new record!</b></p>" +
        "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
        "<p>Your previous best was <b>" + presentation.maxAltitude + "</b> high</p>" +
        "<p>Go for glory, see if you can go higher!</p>");
      showLeaderboard(presentation.rawMaxAltitude, presentation.rawMaxFlightTime);
    } else {
      $message.html("<p>Not bad, but that's not your best so far.</p>" +
        "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
        "<p>Your previous best was <b>" + presentation.maxAltitude + "</b> high</p>" +
        "<p>Give it another go!</p>");
    }
    updateUplinkStatus(presentation);
  }

  this.render = function(presentation) {
    if (!presentation.hasThrow) {
      renderNoThrows(presentation);
    } else if (presentation.hasOneThrow) {
      renderFirstThrow(presentation);
      showLeaderboard(presentation.rawMaxAltitude, presentation.rawMaxFlightTime);
    } else {
      renderMultipleThrows(presentation);
    }
  }

  init();
}

export function create($root){ Display($root); }

export default Display;
