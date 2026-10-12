import {describe, expect, test} from '@jest/globals'
import {spawnSync} from 'node:child_process'

describe('runtime dependencies', () => {
  test.each([
    [
      'unzip-stream',
      `
        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        const path = require('node:path');
        const {Readable} = require('node:stream');
        const {pipeline} = require('node:stream/promises');
        const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'unzip-stream-'));
        process.on('exit', () => fs.rmSync(directory, {recursive: true, force: true}));

        // Both entries contain "abc"; only descriptor.txt uses a data descriptor.
        const archive = Buffer.from(
          'UEsDBBQAAAAIAAAAIVzCQSQ1BQAAAAMAAAAJAAAAa25vd24udHh0S0xKBgBQSwMEFAAIAAgAAAAhXAAAAAAAAAAAAAAAAA4AAABkZXNjcmlwdG9yLnR4dEtMSgYAUEsHCMJBJDUFAAAAAwAAAFBLAQIUAxQAAAAIAAAAIVzCQSQ1BQAAAAMAAAAJAAAAAAAAAAAAAACAAQAAAABrbm93bi50eHRQSwECFAMUAAgACAAAACFcwkEkNQUAAAADAAAADgAAAAAAAAAAAAAAgAEsAAAAZGVzY3JpcHRvci50eHRQSwUGAAAAAAIAAgBzAAAAbQAAAAAA',
          'base64'
        );
        pipeline(
          Readable.from(Array.from(archive, byte => Buffer.from([byte]))),
          require('unzip-stream').Extract({path: directory})
        ).then(() => {
          for (const name of ['known.txt', 'descriptor.txt']) {
            assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), 'abc');
          }
        }).catch(error => {
          console.error(error);
          process.exitCode = 1;
        });
      `
    ],
    [
      'binary',
      `
        const assert = require('node:assert/strict');
        const binary = require('binary');
        const input = Buffer.from('abc');
        assert.equal(binary.parse(input).scan('before', 'b').vars.before.toString(), 'a');
        let scanned = false;
        const stream = binary.stream().scan('before', 'b').tap(vars => {
          assert.equal(vars.before.toString(), 'a');
          scanned = true;
        });
        stream.write(input);
        stream.end();
        process.on('exit', () => assert.equal(scanned, true));
      `
    ],
    [
      'buffers',
      "const Buffers = require('buffers'); const buffers = Buffers([Buffer.from('abc')]); buffers.slice(0, 2); buffers.indexOf('b'); buffers.splice(1, 1)"
    ],
    [
      'tunnel',
      "const http = require('node:http'); const {EventEmitter} = require('node:events'); http.request = () => Object.assign(new EventEmitter(), {end() {}}); const agent = require('tunnel').httpOverHttp({proxy: {host: 'localhost', port: 8080, proxyAuth: 'user:pass'}}); agent.createSocket({host: 'example.com', port: 80}, () => {})"
    ]
  ])('%s avoids deprecated Buffer usage', (_dependency, script) => {
    const result = spawnSync(
      process.execPath,
      ['--pending-deprecation', '--throw-deprecation', '--eval', script],
      {encoding: 'utf8'}
    )

    expect(result.status).toBe(0)
    expect(result.stderr).not.toContain('[DEP0005]')
  })
})
