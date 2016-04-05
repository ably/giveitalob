Sequel.migration do
  up do
    add_column :flights, :device, String
    add_column :flights, :max_flight_time, Integer
  end

  down do
    drop_column :flights, :device
    drop_column :flights, :max_flight_time
  end
end
