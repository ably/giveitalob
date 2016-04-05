class Flight < Sequel::Model(:flights)
  plugin :timestamps, :create => :submitted_at

  def max_altitude=(meters)
    meters = meters.to_f
    raise ArgumentError, 'Maximum altitude must be greater than zero' if meters <= 0
    centimeters = (meters * 100).to_i
    super(centimeters)
  end

  def max_altitude
    super.to_f / 100
  end

  def max_flight_time=(seconds)
    seconds = seconds.to_f
    raise ArgumentError, 'Flight time must be greater than zero' if seconds <= 0
    milliseconds = (seconds * 1000).to_i
    super(milliseconds)
  end

  def max_flight_time
    super.to_f / 1000
  end

  def username=(name)
    name = name.to_s
    raise ArgumentError, 'Username is invalid' if name == ''
    super(name)
  end
end
