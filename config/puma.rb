FORKS = Integer(ENV['WEB_CONCURRENCY'] || 2)

workers FORKS
threads_count = Integer(ENV['MAX_THREADS'] || 10)
threads threads_count, threads_count

port        ENV['PORT']     || 5000
environment ENV['RACK_ENV'] || 'development'

preload_app!

on_worker_boot do
  # Disconnect the Sequel connection pool so new connections are created.
  DB.disconnect
  DB = Sequel.connect(DATABASE_URL, max_connections: (ENV['MAX_DATABASE_CONNECTIONS'] || 20) / FORKS)
end
