require "sinatra/base"
require "sinatra/cookies"
require "sinatra/content_for"
require "digest/sha1"
require "erubis"
require "rollbar/middleware/sinatra"

require "ably"

require_relative './lib/leaderboard'

class LobApp < Sinatra::Base
  helpers Sinatra::Cookies
  helpers Sinatra::ContentFor

  use Rollbar::Middleware::Sinatra

  # Avoid ambiguous characters and letters
  # 31 characters ** 5 = 28m options, never goint to have a clash in reality
  LOB_CODE_PERMITTED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split("")

  set :public_folder, 'public'
  set(:cookie_options) do
    { :expires => Time.now + 3600*24 }
  end

  set :erb, escape_html: true

  get '/' do
    erb :index
  end

  get '/about' do
    erb :about
  end

  get '/why-stream' do
    erb :"why-stream"
  end

  get '/leaderboard' do
    erb :leaderboard, locals: { leaderboard: Leaderboard.best_today, past: '24 hrs' }
  end

  get '/leaderboard/week' do
    erb :leaderboard, locals: { leaderboard: Leaderboard.best_this_week, past: '7 days' }
  end

  get '/leaderboard/month' do
    erb :leaderboard, locals: { leaderboard: Leaderboard.best_this_month, past: '30 days' }
  end

  get '/new-flight/force' do
    cookies['channel_sha'] = 'invalidate'
    redirect '/new-flight'
  end

  get '/new-flight' do
    query_params = ''
    channel_name = if cookies['channel_name'] && (channel_sha(cookies['channel_name']) == cookies['channel_sha'])
      cookies['channel_name']
    else
      create_channel_name.tap do |channel_name|
        query_params = "?cs=#{channel_sha(channel_name)}"
      end
    end
    redirect "/flyer/#{channel_name}#{query_params}"
  end

  get '/flyer/:channel_name' do
    channel_name = params[:channel_name].strip.upcase
    channel_sha = (request.GET['cs'] || cookies['channel_sha']).to_s.strip
    if channel_sha(channel_name) != channel_sha
      status 403
      erb :oops, locals: { error_message: 'This channel name you are using is not permitted as our security checks have failed.' }
    else
      cookies['channel_name'] = channel_name
      cookies['channel_sha'] = channel_sha(cookies['channel_name'])
      erb :flyer, locals: { channel_name: channel_name }
    end
  end

  get '/flyer/:channel_name/token' do
    channel_name = params[:channel_name].strip.upcase
    if !channel_name
      status 400
      erb :oops, locals: { error_message: 'That is not a valid channel name' }
    else
      content_type :json
      capability = {
        '*' => ['subscribe', 'history'],
        channel_name => ['subscribe', 'publish', 'history', 'presence'],
        "flights:#{channel_name}" => ['subscribe', 'publish', 'history'],
        "broadcast:channel" => ['subscribe', 'publish', 'history'] # channel name replicated in config.js
      }
      client.auth.create_token_request(client_id: channel_name, capability: capability).to_json
    end
  end

  get '/track-flight' do
    channel_name = request.GET['channel-name'].to_s.strip.upcase
    if channel_name == ''
      status 400
      erb :oops, locals: { error_message: 'You are missing a valid channel name' }
    else
      redirect "/track/#{channel_name}"
    end
  end

  get '/track/:channel_name' do
    channel_name = params[:channel_name].strip.upcase
    erb :tracker, locals: { channel_name: channel_name }
  end

  get '/token' do
    content_type :json
    capability = { '*' => ['subscribe', 'history'] }
    client.auth.create_token_request(capability: capability).to_json
  end

  post '/submit-flight' do
    begin
      username = request.POST['nickname'];
      max_altitude = request.POST['max-altitude']; # m
      max_flight_time = request.POST['max-flight-time']; # seconds
      device = request.POST['device'];

      flight = Flight.new(
        username: username,
        max_altitude: max_altitude,
        max_flight_time: max_flight_time,
        device: device
      )

      Leaderboard.submit_flight(flight)
      content_type :json
      { message: "Submitted successfully" }.to_json
    rescue ArgumentError => err
      status 400
      content_type :json
      { error: true, message: err.message }.to_json
    end
  end

  not_found do
    status 404
    erb :oops, locals: { error_message: 'Sorry, this page does not exist' }
  end

  helpers do
    # Cloudflare Cache is never invalidated because the URL to the assets remains the same
    def cache_invalidator_param
      "?ver=#{ENV['HEROKU_SLUG_COMMIT']}" if ENV['HEROKU_SLUG_COMMIT']
    end
  end

  def client
    @client ||= Ably::Rest.new(key: ENV.fetch("ABLY_API_KEY"))
  end

  def create_channel_name
    5.times.map do
      LOB_CODE_PERMITTED_CHARS.sample
    end.join()
  end

  def channel_sha(channel_name)
    Digest::SHA1.hexdigest("#{channel_name}#{ENV.fetch("CHANNEL_SALT")}")[0...20]
  end
end
