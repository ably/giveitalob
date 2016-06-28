require_relative './flight'

class Leaderboard
  ONE_HOUR = 60 * 60

  def self.best_today(limit: 100)
    day_ago = Time.now - 24 * ONE_HOUR
    Flight
      .where('submitted_at > ?', day_ago)
      .order(:max_altitude)
      .reverse
      .limit(limit)
      .all
  end

  def self.best_this_week(limit: 100)
    week_ago = Time.now - 7 * 24 * ONE_HOUR
    Flight
      .where('submitted_at > ?', week_ago)
      .order(:max_altitude)
      .reverse
      .limit(limit)
      .all
  end

  def self.best_this_month(limit: 100)
    month_ago = Time.now - 30 * 24 * ONE_HOUR
    Flight
      .where('submitted_at > ?', month_ago)
      .order(:max_altitude)
      .reverse
      .limit(limit)
      .all
  end

  def self.submit_flight(flight)
    flight.save
  end
end
