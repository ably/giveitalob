require File.expand_path('../server/boot', __FILE__)
require 'rake/testtask'

test_tasks = Dir['server/test/*/'].map { |d| File.basename(d) }

test_tasks.each do |folder|
  Rake::TestTask.new("test:#{folder}") do |test|
    test.pattern = "server/test/#{folder}/**/*_test.rb"
    test.verbose = true
  end
end

desc "Run application test suite"
Rake::TestTask.new("test") do |test|
  test.pattern = "server/test/**/*_test.rb"
  test.verbose = true
end

namespace :db do
  # DEBT make server/config/database
  Sequel.extension :migration

  namespace :migrate do

    desc "Perform migration reset (full erase and migration up)"
    task :reset do
      Sequel::Migrator.run(DB, "database/migrations", :target => 0)
      Sequel::Migrator.run(DB, "database/migrations")
      puts "<= sq:migrate:reset executed"
    end

    desc "Perform migration up/down to VERSION"
    task :to do
      version = ENV['VERSION'].to_i
      raise "No VERSION was provided" if version.nil?
      Sequel::Migrator.run(DB, "database/migrations", :target => version)
      puts "<= sq:migrate:to version=[#{version}] executed"
    end

    desc "Perform migration up to latest migration available"
    task :up do
      Sequel::Migrator.run(DB, "database/migrations")
      puts "<= sq:migrate:up executed"
    end

    desc "Perform migration down (erase all data)"
    task :down do
      Sequel::Migrator.run(DB, "database/migrations", :target => 0)
      puts "<= sq:migrate:down executed"
    end
  end
end
