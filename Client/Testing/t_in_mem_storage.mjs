/*
 * Top Matter
 */

/* NOTE: This is for the legacy storage API.  Now deprecated. */

import assert  from "../Source/Utilities/assert";
import SM      from "../Source/Storage/in_memory";
import * as SW from "../Source/Storage/wrappers";
import * as CB from "../Source/Crypto/basics";
const WCS = CB.CS;

async function just_upload( s ) {
    var resp = await s.upload( { path: "sadf" }, { header_hooks:[], body:new Uint8Array(6) } );
    console.log( "just_upload", resp.ok, resp.status, resp.statusText );
    assert( resp.ok );
}

async function up_down( s ) {
    const j = SW.encodingWrapper( SW.SK_JSON, {}, s );
    const obj_orig = { a: "42", b: 42 };
    var resp_u = await j.upload( { path: "t2" }, { body: obj_orig } );
    var resp_d = await j.download( { path: "t2" }, {} );
    var obj_down = await resp_d.json();
    console.log( "up_down", resp_d.ok, resp_d.status, resp_d.statusText, obj_down );
    assert( JSON.stringify( obj_orig ) === JSON.stringify( obj_down ) );
}

async function up_down_crypto( s ) {
    async function generateKeyIV() {
        const k = await WCS.generateKey(
            { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
        const iv = new Uint8Array( 16 );
        return { key: k, iv: iv };
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
              { param_name: "key_iv",
                key_iv_generator: generateKeyIV },
              SW.confidentialityWrapper(
                  { encrypt: encrypt,
                    decrypt: decrypt },
                  s ) ) );
    const obj_orig = { a: "42", b: 42, c: [ 7, 8 ] };
    var resp_u = await j.upload( { path: "tx2" }, { body: obj_orig } );
    const fp_u = resp_u.file_ptr;
    console.log( "up_down_cryptoA", resp_u.ok, resp_u.status, resp_u.statusText, fp_u.iv, fp_u.key );
    const fp = Object.assign( { path: "tx2" }, resp_u.file_ptr );
    var resp_d = await j.download( fp, {} );
    var obj_down = await resp_d.json();
    console.log( "up_down_cryptoB", resp_d.ok, resp_d.status, resp_d.statusText, obj_down );
    assert( JSON.stringify( obj_orig ) === JSON.stringify( obj_down ) );
}

async function up_down_crypto_verify( s ) {
    async function generateStuff() {
        const kc = await WCS.generateKey(
            { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
        const iv = new Uint8Array( 16 );
        const ks = await WCS.generateKey(
            { name: "HMAC", hash:"SHA-256" }, true, [ "sign", "verify" ] );
        return { keyC:kc, iv:iv, keyS:ks };
    }
    async function fpToPlainData( fp )
    {
        return { keyC: await WCS.exportKey( "jwk", fp.keyC ),
                 iv  : fp.iv,
                 keyS: await WCS.exportKey( "jwk", fp.keyS ) };
    }
    function encrypt( data, file_ptr ) {
        return WCS.encrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
    }
    function decrypt( data, file_ptr ) {
        return WCS.decrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
    }
    async function sign( data, file_ptr ) {
        const signature = await WCS.sign( { name: "HMAC" }, file_ptr.keyS, data );
        console.log( "SIGN", ( await WCS.exportKey( "jwk", file_ptr.keyS ) ).k,
                     ( new Uint8Array( data ) ).join(),
                     ( new Uint8Array( signature ) ).join() );
        return signature;
    }
    async function verify( signature, data, file_ptr ) {
        const verif = await WCS.verify( { name: "HMAC" }, file_ptr.keyS, signature, data );
        console.log( "VERF", ( await WCS.exportKey( "jwk", file_ptr.keyS ) ).k,
                     ( new Uint8Array( data ) ).join(),
                     ( new Uint8Array( signature ) ).join(),
                     verif );
        return verif;
    }

    const j = SW.authedPrivateJsonWrapper(
        { param_name: "stuff",
          stuff_generator: generateStuff,
          encrypt: encrypt,
          decrypt: decrypt,
          tag_bytes: 32,
          sign: sign,
          verify: verify },
        s);

    const obj_orig = { a: "42", b: 42, c: [ 7, 8 ], d:"quick brown" };
    const resp_u = await j.upload( { path: "tx2" }, { body: obj_orig } );
    console.log( "V1", resp_u.ok, resp_u.status, resp_u.statusText, resp_u.file_ptr.iv, resp_u.file_ptr.key );
    const resp_d = await j.download( resp_u.file_ptr, {} );
    const obj_down = await resp_d.json();
    console.log( "V1b", resp_d.ok, resp_d.status, resp_d.statusText, obj_down );
    assert( JSON.stringify( obj_orig ) === JSON.stringify( obj_down ) );
}

async function main() {
    const s = SM( { path_prefix: [ "alice", "home" ] } );
    await just_upload( s );
    await up_down( s );
    await up_down_crypto( s );
    await up_down_crypto_verify( s );
    console.log( "VICTORY" );
}

main();

console.log( "t_in_mem_storage reached EOF" );
