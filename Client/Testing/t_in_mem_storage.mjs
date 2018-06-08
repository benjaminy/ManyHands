/*
 * Top Matter
 */

import assert  from "../Source/Utilities/assert";
import SM      from "../Source/Storage/in_memory";
import * as SW from "../Source/Storage/wrappers";
import * as CB from "../Source/Crypto/basics";
const WCS = CB.CS;

const u1 = async function u1( s ) {
    var resp = await s.upload( { path: "sadf" }, { header_hooks:[], body:new Uint8Array(6) } );
    console.log( "U1", resp.ok, resp.status, resp.statusText );
};

const e1 = async function e1( s ) {
    const j = SW.encodingWrapper( SW.SK_JSON, {}, s );
    var resp1 = await j.upload( { path: "t2" }, { body: { a: "42", b: 42 } } );
    var resp2 = await j.download( { path: "t2" }, {} );
    var yelp = await resp2.json();
    console.log( "E1", resp2.ok, resp2.status, resp2.statusText, yelp );
};

const c1 = async function c1( s ) {
    const crypto = {};
    function generateKey() {
        return WCS.generateKey(
            { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
    }
    function generateIV() {
        return Promise.resolve( new Uint8Array( 16 ) );
    }
    function encrypt( data, file_ptr ) {
        return WCS.encrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.key, data );
    }
    function decrypt( data, file_ptr ) {
        console.log( "!!!DE" );
        return WCS.decrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.key, data );
    }
    const j =
      SW.encodingWrapper(
          SW.SK_JSON, {},
          SW.filePtrGenWrapper(
              { param_name: "key",
                key_generator: generateKey },
              SW.filePtrGenWrapper(
                  { param_name: "iv",
                    iv_generator: generateIV },
                  SW.confidentialityWrapper(
                      { encrypt: encrypt,
                        decrypt: decrypt },
                      s ) ) ) );
    var resp1 = await j.upload( { path: "tx2" }, { body: { a: "42", b: 42, c: [ 7, 8 ] } } );
    console.log( "C1", resp1.ok, resp1.status, resp1.statusText, resp1.file_ptr.iv, resp1.file_ptr.key );
    const fp = Object.assign( { path: "tx2" }, resp1.file_ptr );
    var resp2 = await j.download( fp, {} );
    console.log( "C1b", resp1.ok, resp1.status, resp1.statusText, await resp2.json() );
};

const v1 = async function v1( s ) {
    const crypto = {};
    function generateCryptKey() {
        return WCS.generateKey(
            { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
    }
    function generateSignKey() {
        return WCS.generateKey(
            { name: "HMAC", hash:"SHA-256" }, true, [ "sign", "verify" ] );
    }
    function generateIV() {
        return Promise.resolve( new Uint8Array( 16 ) );
    }
    function encrypt( data, file_ptr ) {
        return WCS.encrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
    }
    function decrypt( data, file_ptr ) {
        return WCS.decrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
    }
    function sign( data, file_ptr ) {
        return WCS.sign( { name: "HMAC" }, file_ptr.keyS, data );
    }
    function verify( signature, data, file_ptr ) {
        return WCS.verify( { name: "HMAC" }, file_ptr.keyS, signature, data );
    }
    const j =
      SW.encodingWrapper(
          SW.SK_JSON, {},
          SW.filePtrGenWrapper(
              { param_name: "keyC",
                keyC_generator: generateCryptKey },
              SW.filePtrGenWrapper(
                  { param_name: "iv",
                    iv_generator: generateIV },
                  SW.confidentialityWrapper(
                      { encrypt: encrypt,
                        decrypt: decrypt },
                      SW.filePtrGenWrapper(
                          { param_name: "keyS",
                            keyS_generator: generateSignKey },
                          SW.authenticityWrapper(
                              { tag_bytes: 32,
                                sign: sign,
                                verify: verify },
                              s ) ) ) ) ) );

    var resp1 = await j.upload( { path: "tx2" }, { body: { a: "42", b: 42, c: [ 7, 8 ], d:"quick brown" } } );
    console.log( "V1", resp1.ok, resp1.status, resp1.statusText, resp1.file_ptr.iv, resp1.file_ptr.key );
    const fp = Object.assign( { path: "tx2" }, resp1.file_ptr );
    var resp2 = await j.download( fp, {} );
    console.log( "V1b", resp1.ok, resp1.status, resp1.statusText, await resp2.json() );
};

const main = async function main() {
    const s = SM( "alice" );
    await u1( s );
    await e1( s );
    await c1( s );
    await v1( s );
    console.log( "VICTORY" );
};

main();

console.log( "t_in_mem_storage reached EOF" );
