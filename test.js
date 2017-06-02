'use strict';

var fs = require('fs');
var os = require('os');
var expect = require('chai').expect;
var broccoli = require('broccoli');
var path = require('path');
var Babel = require('./index');
var helpers = require('broccoli-test-helpers');
var stringify = require('json-stable-stringify');
var mkdirp = require('mkdirp').sync;
var rm = require('rimraf').sync;
var makeTestHelper = helpers.makeTestHelper;
var cleanupBuilders = helpers.cleanupBuilders;
var Promise = require('rsvp').Promise;
var moduleResolve = require('amd-name-resolver').moduleResolve;
var transformOptions = require('./lib/transform-options');

var inputPath = path.join(__dirname, 'fixtures');
var expectations = path.join(__dirname, 'expectations');

var babel;

function fixtureFullPath(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

describe('options', function() {
  var options;

  before(function() {
    options = {
      foo: 1,
      bar: {
        baz: 1
      },
      filterExtensions: ['es6']
    };

    babel = new Babel('foo', options);
  });

  it('are cloned', function() {
    var transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.foo).to.eql(1);
    expect(transpilerOptions.bar.baz).to.eql(1);

    options.foo = 2;
    options.bar.baz = 2;

    expect(transpilerOptions.foo).to.eql(1);
    expect(transpilerOptions.bar.baz).to.eql(1);
  });

  it('correct fileName, sourceMapName, sourceFileName', function() {
    var transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.moduleId).to.eql(undefined);
    expect(transpilerOptions.filename).to.eql('relativePath');
    expect(transpilerOptions.sourceMapName).to.eql('relativePath');
    expect(transpilerOptions.sourceFileName).to.eql('relativePath');
  });

  it('includes moduleId if options.moduleId is true', function() {
    babel.options.moduleId = true;
    babel.options.filename = 'relativePath.es6';

    var transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.moduleId).to.eql('relativePath');
  });

  it('does not propagate validExtensions', function () {
    var transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.filterExtensions).to.eql(undefined);
  });
});

describe('transpile ES6 to ES5', function() {

  before(function() {
    babel = makeTestHelper({
      subject: function() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('basic', function () {
    return babel('files', {
      inputSourceMap:false,
      sourceMap: false
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic - parallel API', function () {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        ['transform-strict-mode-||', fixtureFullPath('transform-strict-mode-parallel'), {}],
        ['transform-es2015-block-scoping-||', fixtureFullPath('transform-es2015-block-scoping-parallel'), {}]
      ]
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic - parallel API (in main process)', function () {
    var pluginFunction = require('babel-plugin-transform-es2015-block-scoping');
    pluginFunction.baseDir = function() {
      return path.join(__dirname, 'node_modules', 'babel-plugin-transform-es2015-block-scoping');
    };
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        ['some-plugin-||', fixtureFullPath('transform-strict-mode-parallel'), {}],
        pluginFunction,
      ]
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic (in main process)', function () {
    var pluginFunction = require('babel-plugin-transform-strict-mode');
    pluginFunction.baseDir = function() {
      return path.join(__dirname, 'node_modules', 'babel-plugin-transform-strict-mode');
    };
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      // cannot parallelize if any of the plugins are functions
      plugins: [
        pluginFunction,
        'transform-es2015-block-scoping'
      ]
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('inline source maps', function () {
    return babel('files', {
      sourceMap: 'inline'
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected-inline-source-maps.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('modules (in main process)', function () {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ],
      resolveModuleSource: moduleResolve
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'imports.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('modules - parallel API', function () {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ],
      resolveModuleSource: ['amd-name-resolver-||', fixtureFullPath('amd-name-resolver-parallel'), {}]
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'imports.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });
});

describe('filters files to transform', function() {

  before(function() {
    babel = makeTestHelper({
      subject: function() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('default', function () {
    return babel('files', {
      inputSourceMap:false,
      sourceMap: false
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.be.ok;

    });
  });

  it('uses specified filter', function () {
    return babel('files', {
      filterExtensions: ['es6'],
      inputSourceMap: false,
      sourceMap: false
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures-es6.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.not.be.ok;

    });
  });

  it('uses multiple specified filters', function() {
    return babel('files', {
      filterExtensions: ['js', 'es6'],
      inputSourceMap: false,
      sourceMap: false
    }).then(function(results) {
      var outputPath = results.directory;

      var es6ExtOutput = fs.readFileSync(path.join(outputPath, 'fixtures-es6.js'), 'utf8');
      var jsExtOutput = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(es6ExtOutput).to.eql(input);
      expect(jsExtOutput).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.not.be.ok;
    });
  });

  it('named module', function() {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      moduleId: "foo",
      modules: 'amdStrict'
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'named-module-fixture.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'named-module.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });


  it('moduleId === true', function() {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      moduleId: true,
      modules: 'amdStrict'
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'true-module-fixture.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'true-module.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('throws if a single helper is not whitelisted', function() {
    return babel('files', {
      helperWhiteList: ['class-call-check', 'get']
    }).catch(function(err) {
      expect(err.message).to.equal('fixtures-classes.js was transformed and relies on `inherits`, which was not included in the helper whitelist. Either add this helper to the whitelist or refactor to not be dependent on this runtime helper.');
    });
  });

  it('throws if multiple helpers are not whitelisted', function() {
    return babel('files', {
      helperWhiteList: [],
    }).catch(function(err) {
      expect(err.message).to.equal('fixtures-classes.js was transformed and relies on `class-call-check`, `get`, & `inherits`, which were not included in the helper whitelist. Either add these helpers to the whitelist or refactor to not be dependent on these runtime helper.');
    });
  });

  it('does not throw if helpers are specified', function() {
    return babel('files', {
      helperWhiteList: ['class-call-check', 'get', 'inherits'],
    }).then(function(results) {
      var outputPath = results.directory;
      var output = fs.readFileSync(path.join(outputPath, 'fixtures-classes.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'classes.js'), 'utf8');
      expect(output).to.eql(input);
    });
  });
});

describe.skip('module metadata', function() {
  before(function() {
    babel = makeTestHelper({
      subject: function() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('exports module metadata', function() {
    return babel('files', {
      exportModuleMetadata: true,
      moduleId: true,
      modules: 'amdStrict',
      sourceMap: false,
      inputSourceMap: false
    }).then(function(results) {
      var outputPath = results.directory;
      var output = fs.readFileSync(path.join(outputPath, 'dep-graph.json'), 'utf8');
      var expectation = fs.readFileSync(path.join(expectations, 'dep-graph.json'), 'utf8');
      expect(output).to.eql(expectation);
    });
  });

  it('handles adding and removing files', function() {
    return babel('files', {
      exportModuleMetadata: true,
      moduleId: true,
      modules: 'amdStrict',
      sourceMap: false,
      inputSourceMap: false
    }).then(function(results) {
      // Normal build
      var outputPath = results.directory;
      var output = fs.readFileSync(path.join(outputPath, 'dep-graph.json'), 'utf8');
      var expectation = fs.readFileSync(path.join(expectations, 'dep-graph.json'), 'utf8');
      expect(output).to.eql(expectation);

      // Move away files/fixtures.js
      fs.renameSync(path.join(inputPath, 'files', 'fixtures.js'), path.join(inputPath, 'fixtures.js'));
      return results.builder();
    }).then(function(results) {
      // Add back file/fixtures.js
      fs.renameSync(path.join(inputPath, 'fixtures.js'), path.join(inputPath, 'files', 'fixtures.js'));

      // Build without files/fixtures.js
      var outputPath = results.directory;
      var output = fs.readFileSync(path.join(outputPath, 'dep-graph.json'), 'utf8');
      var expectation = fs.readFileSync(path.join(expectations, 'pruned-dep-graph.json'), 'utf8');
      expect(output).to.eql(expectation);

      return results.builder();
    }).then(function(results) {
      // Back to the first build
      var outputPath = results.directory;
      var output = fs.readFileSync(path.join(outputPath, 'dep-graph.json'), 'utf8');
      var expectation = fs.readFileSync(path.join(expectations, 'dep-graph.json'), 'utf8');
      expect(output).to.eql(expectation);
    });
  });

  describe('_generateDepGraph', function() {
    var tmp = path.join(process.cwd(), 'test-temp');
    beforeEach(function() {
      mkdirp(tmp);
      babel = new Babel('foo');
      babel.outputPath = tmp;
    });

    afterEach(function() {
      rm(tmp);
      babel.outputPath = null;
    });

    it('should generate a graph', function() {
      babel._cache.keys = function() {
        return ['foo.js', 'bar.js'];
      };

      babel.moduleMetadata = {
        foo: {},
        bar: {}
      };

      babel._generateDepGraph();

      expect(fs.readFileSync(path.join(babel.outputPath, 'dep-graph.json'), 'utf8')).to.eql(stringify({
        bar: {},
        foo: {}
      }, { space: 2 }));
    });

    it('should evict imports from the graph that are no longer in the tree', function() {
      babel._cache.keys = function() {
        return ['foo.js'];
      };

      babel.moduleMetadata = {
        foo: {}
      };

      babel._generateDepGraph();

      expect(fs.readFileSync(path.join(babel.outputPath, 'dep-graph.json'), 'utf8')).to.eql(stringify({
        foo: {}
      }, { space: 2 }));
    });
  });

});

describe('consume broccoli-babel-transpiler options', function() {
  it('enabled', function() {
    var options = {
      exportModuleMetadata: true,
      browserPolyfill: true
    };

    babel = new Babel('foo', options);
    var code = babel.processString('path', 'relativePath');
    expect(code).to.be.ok;
  });

  it('explicitly disabled', function() {
    var options = {
      exportModuleMetadata: false,
      browserPolyfill: false
    };

    babel = new Babel('foo', options);
    var code = babel.processString('path', 'relativePath');
    expect(code).to.be.ok;
  });
});

describe('when options change', function() {
  var originalHash, options, fakeConsole, consoleMessages;

  beforeEach(function() {
    fakeConsole = {
      warn: function(message) { consoleMessages.push(message); }
    };
    consoleMessages = [];

    options = {
      bar: 1,
      baz: function() {},
      console: fakeConsole,
      plugins: []
    };

    var babel = new Babel('foo', options);

    originalHash = babel.optionsHash();
  });

  it('clears cache for added properties', function() {
    options.foo = 1;
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes object plugins cacheKey result in hash', function() {
    options.plugins = [
      { cacheKey: function() { return 'hi!'; }}
    ];
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes function plugins cacheKey result in hash', function() {
    function fakePlugin() {}
    fakePlugin.cacheKey = function() { return 'Hi!'; };

    options.plugins = [
      fakePlugin
    ];
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes string plugins in hash calculation', function() {
    options.plugins = [
      'foo'
    ];
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes plugins specified with options in hash calculation when cacheable', function() {
    var pluginOptions = { foo: 'bar' };
    options.plugins = [
      ['foo', pluginOptions]
    ];
    options.console = fakeConsole;
    var first = new Babel('foo', options);
    var firstOptions = first.optionsHash();

    options.console = fakeConsole;
    var second = new Babel('foo', options);
    var secondOptions = second.optionsHash();
    expect(firstOptions).to.eql(secondOptions);

    pluginOptions.qux = 'huzzah';
    options.console = fakeConsole;
    var third = new Babel('foo', options);
    var thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('invalidates plugins specified with options when not-cacheable', function() {
    function thing() { }
    var pluginOptions = { foo: 'bar', thing: thing };
    options.plugins = [
      ['foo', pluginOptions]
    ];
    options.console = fakeConsole;
    var first = new Babel('foo', options);
    var firstOptions = first.optionsHash();

    options.console = fakeConsole;
    var second = new Babel('foo', options);
    var secondOptions = second.optionsHash();
    expect(firstOptions).to.not.eql(secondOptions);
  });

  it('plugins specified with options can have functions with `baseDir`', function() {
    var dir = path.join(inputPath, 'plugin-a');
    function thing() { }
    thing.baseDir = function() { return dir; };
    var pluginOptions = { foo: 'bar', thing: thing };
    options.plugins = [
      ['foo', pluginOptions]
    ];

    options.console = fakeConsole;
    var first = new Babel('foo', options);
    var firstOptions = first.optionsHash();

    options.console = fakeConsole;
    var second = new Babel('foo', options);
    var secondOptions = second.optionsHash();
    expect(firstOptions).to.eql(secondOptions);

    dir = path.join(inputPath, 'plugin-b');
    options.console = fakeConsole;
    var third = new Babel('foo', options);
    var thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('a plugins `baseDir` method is used for hash generation', function() {
    var dir = path.join(inputPath, 'plugin-a');

    function plugin() {}
    plugin.baseDir = function() {
      return dir;
    };
    options.plugins = [ plugin ];

    options.console = fakeConsole;
    var first = new Babel('foo', options);
    var firstOptions = first.optionsHash();

    dir = path.join(inputPath, 'plugin-b');
    options.console = fakeConsole;
    var second = new Babel('foo', options);
    var secondOptions = second.optionsHash();

    expect(firstOptions).to.not.eql(secondOptions);
  });

  it('a plugin without a baseDir invalidates the cache every time', function() {
    function plugin() {}
    plugin.toString = function() { return '<derp plugin>'; };
    options.plugins = [ plugin ];

    options.console = fakeConsole;
    var babel1 = new Babel('foo', options);
    options.console = fakeConsole;
    var babel2 = new Babel('foo', options);

    expect(babel1.optionsHash()).to.not.eql(babel2.optionsHash());
    expect(consoleMessages).to.eql([
      'broccoli-babel-transpiler is opting out of caching due to a plugin that does not provide a caching strategy: `<derp plugin>`.',
      'broccoli-babel-transpiler is opting out of caching due to a plugin that does not provide a caching strategy: `<derp plugin>`.'
    ]);
  });

  it('clears cache for updated properties', function() {
    options.bar = 2;
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('clears cache for added methods', function() {
    options.foo = function() {};
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('clears cache for updated methods', function() {
    options.baz = function() { return 1; };
    options.console = fakeConsole;
    var babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });
});

describe('on error', function() {

  before(function() {
    babel = makeTestHelper({
      subject: function() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders();
  });

  it('returns error from the main process', function () {
    var pluginFunction = require('babel-plugin-transform-strict-mode');
    pluginFunction.baseDir = function() {
      return path.join(__dirname, 'node_modules', 'babel-plugin-transform-strict-mode');
    };
    return babel('errors', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        pluginFunction,
        'transform-es2015-block-scoping'
      ]
    }).then(
      function onSuccess(results) {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.eql('fixtures.js: Unexpected token (1:9)');
      }
    );
  });

  it('returns error from a worker process', function () {
    return babel('errors', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ]
    }).then(
      function onSuccess(results) {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.eql('fixtures.js: Unexpected token (1:9)');
      }
    );
  });

  it('retries if worker process is terminated once', function () {
    var ripFilePath = path.join(os.tmpdir(), 'rip.js');
    if (fs.existsSync(ripFilePath)) { fs.unlinkSync(ripFilePath); }

    // only one file so that multiple processes are not trying to concurrently read/write/delete rip.js
    return babel('file', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        ['transform-strict-mode-||', fixtureFullPath('transform-strict-mode-die-once'), { ripFile: ripFilePath }],
        'transform-es2015-block-scoping'
      ]
    }).then(function(results) {
      var outputPath = results.directory;

      var output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      var input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('fails if worker process is terminated more than once', function () {
    return babel('files', {
      inputSourceMap: false,
      sourceMap: false,
      plugins: [
        ['transform-strict-mode-||', fixtureFullPath('transform-strict-mode-die-always'), {}],
        'transform-es2015-block-scoping'
      ]
    }).then(
      function onSuccess(results) {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.eql('Worker terminated unexpectedly');
      }
    );
  });
});

describe('transform options', function() {

  it('passes other options through', function () {
    var options = {
      inputSourceMap: false,
      sourceMap: false,
      somethingElse: 'foo',
    };
    expect(transformOptions(options)).to.eql({
      inputSourceMap: false,
      sourceMap: false,
      somethingElse: 'foo',
    });
  });

  it('leaves plugin functions and strings alone', function () {
    var pluginFunction = function doSomething() {
      return 'something';
    };
    var options = {
      plugins: [
        pluginFunction,
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ]
    };
    expect(transformOptions(options)).to.eql({
      plugins: [
        pluginFunction,
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ]
    });
  });

  it('builds plugins using the parallel API', function () {
    var options = {
      plugins: [
        ['some plugins name', fixtureFullPath('transform-strict-mode-parallel'), { foo: 'bar' }],
        'transform-es2015-block-scoping'
      ]
    };
    expect(transformOptions(options)).to.eql({
      plugins: [
        'transform-strict-mode',
        'transform-es2015-block-scoping'
      ]
    });
  });

  it('leaves resolveModuleSource function alone', function () {
    var options = {
      resolveModuleSource: moduleResolve
    };
    expect(transformOptions(options)).to.eql({
      resolveModuleSource: moduleResolve
    });
  });

  it('builds resolveModuleSource using the parallel API', function () {
    var options = {
      resolveModuleSource: ['amd-name-resolver-||', fixtureFullPath('amd-name-resolver-parallel'), {}]
    };
    expect(transformOptions(options)).to.eql({
      resolveModuleSource: moduleResolve
    });
  });
});
