# Lob - How high can you throw your phone?

Demo: <a href="https://giveitalob.com">giveitalob.com</a>

Demonstrating realtime connection between web browsers. Powered by [Ably, simply better realtime messaging](https://www.ably.io)

### Installation

Requires Ruby, RubyGems, Node.js and Npm to be installed.

1. Clone source from [github](https://github.com/CrowdHailer/lob).

```
git clone git@github.com:CrowdHailer/lob.git
cd lob
```

2. Fetch dependencies.

```
bundle
npm install
git submodule init && git submodule update
```

3. Create database, requires postgres to be set up and user and passwords to be set.

```
createdb lob_development
rake db:migrate:up
```

4. Obtain an [Ably API key](https://www.ably.io) and add to [.env](.env). See [.env.example](.env.example) for an example of how to configure this file.

5. Build your assets. `npm run build` to build and copy assets.

6. Run the local version by executing `puma`. If you want the app to reload automatically when changes are made, try `rerun -d client,config,server puma`. The application will the be available on all network interfaces on port 5000.

### Tests

Run all the tests through rake and npm.

```
rake test && npm test
```
