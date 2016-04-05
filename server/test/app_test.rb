require_relative './test_config'

require_relative '../boot'
require_relative '../app'

class AppTest < MiniTest::Test
  include Rack::Test::Methods

  def app
    LobApp
  end

  def run(*args, &block)
    Sequel::Model.db.transaction(:rollback=>:always, :auto_savepoint=>true){super}
  end

  def test_the_index_page_is_available
    get '/'
    assert last_response.ok?
  end

  def test_the_about_page_is_available
    get '/about'
    assert last_response.ok?
  end

  def test_the_leaderboard_page_is_available
    get '/leaderboard'
    assert last_response.ok?
  end

  def test_the_week_leaderboard_page_is_available
    get '/leaderboard/week'
    assert last_response.ok?
  end

  def test_the_month_leaderboard_page_is_available
    get '/leaderboard/month'
    assert last_response.ok?
  end

  def test_posting_new_flight_redirects_with_token_and_channel
    # DEBT start flight
    get '/new-flight'
    assert_match(/flyer\?channel-name=[A-Z0-9]{4}&token=/, last_response.location)
  end

  def test_page_for_new_flyer_is_available
    # DEBT should check for channel name and token
    get '/flyer'
    assert last_response.ok?
  end

  def test_request_tracking_a_flight_should_redirect_with_token_and_channel
    get '/track-flight', {'channel-name': 'QWER'}
    # DEBT might make sense to redirect to /tracker/:channel-name
    assert_match(/tracker\?channel-name=QWER&token=/, last_response.location)
  end

  def test_link_to_track_a_flight_should_redirect_with_token_and_channel
    get '/track/QWER'
    # DEBT might make sense to redirect to /tracker/:channel-name
    assert_match(/tracker\?channel-name=QWER&token=/, last_response.location)
  end

  def test_page_for_new_tracker_is_available
    # DEBT should check for channel name and token
    get '/tracker'
    assert last_response.ok?
  end

  def test_submitting_a_record_flight_record_should_add_it_leaderboard
    leaderboard = Leaderboard.new
    post '/submit-flight', {'max-altitude': 12.10, username: 'my iPhone'}
    assert_equal Leaderboard.best_today.first.max_altitude, 12.10
    assert last_response.ok?
  end

  def test_submitting_an_invalid_flight_will_fail
    leaderboard = Leaderboard.new
    post '/submit-flight', {'max-altitude': 12.10, username: ''}
    assert_equal [], Leaderboard.best_today
    assert_equal 400, last_response.status
    assert_match /Username is invalid/, last_response.body
  end
end
