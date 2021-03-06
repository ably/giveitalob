# Lob - How high can you throw your phone?

Demo: <a href="https://giveitalob.com">giveitalob.com</a>

Demonstrating realtime connection between web browsers. Powered by [Ably, simply better realtime messaging](https://www.ably.com)

### Installation

Requires Ruby, RubyGems, Node.js and Npm to be installed.

1. Clone source from [github](https://github.com/ably/giveitalob).

```
).
git clone https://github.com/ably/giveitalob
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

4. Obtain an [Ably API key](https://www.ably.com) and add to [.env](.env). See [.env.example](.env.example) for an example of how to configure this file.

5. Build your assets. `npm run build` to build and copy assets. If you want the app to rebuild assets automatically, try `rerun -d assets,client npm run build`.

6. Run the local version by executing `puma`. If you want the app to reload automatically when changes are made, try `rerun -d config,server puma`. The application will the be available on all network interfaces on port 5000.

### Tests

Run all the tests through rake and npm.

```
rake test
```
