#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

import util from "util";
import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const WCS = WC.subtle;

async function main()
{
    const curve = "P-256";
    const dsa = { name: "ECDSA", namedCurve: curve };
    const dh  = { name:  "ECDH", namedCurve: curve };
    const keyOps = ( k, ko ) => Object.assign( {}, k, { key_ops: ko } );

    const k_gen_dsa = await WCS.generateKey( dsa, true, [ "sign", "verify" ] );
    console.log( "GEN DSA", k_gen_dsa );


    const k_gen_dh  = await WCS.generateKey(  dh, true, [ "deriveKey", "deriveBits" ] );
    console.log( "GEN DH", k_gen_dh );


    const k_exp_dsa_pub = await WCS.exportKey( "jwk", k_gen_dsa.publicKey );
    console.log( "EXP DSA PUB", k_exp_dsa_pub );
    const k_exp_dsa_pri = await WCS.exportKey( "jwk", k_gen_dsa.privateKey );
    console.log( "EXP DSA PRI", k_exp_dsa_pri );
    const k_exp_dh_pub  = await WCS.exportKey( "jwk", k_gen_dh.publicKey );
    console.log( "EXP DH PUB",  k_exp_dh_pub );
    const k_exp_dh_pri  = await WCS.exportKey( "jwk", k_gen_dh.privateKey );
    console.log( "EXP DH PRI",  k_exp_dh_pri );


    const k_imp_dsa_pub = await WCS.importKey(
        "jwk", keyOps( k_exp_dh_pub, [ "verify" ] ), dsa, true, [ "verify" ] );
    console.log( "IMP DSA PUB", k_imp_dsa_pub );
    const k_imp_dsa_pri = await WCS.importKey(
        "jwk", keyOps( k_exp_dh_pri, [ "sign" ] ), dsa, true, [ "sign" ] );
    console.log( "IMP DSA PRI", k_imp_dsa_pri );
    const k_imp_dh_pub = await WCS.importKey(
        "jwk", keyOps( k_exp_dsa_pub, [ ] ), dh, true, [ ] );
    console.log( "IMP DH PUB",  k_imp_dh_pub );
    const k_imp_dh_pri = await WCS.importKey(
        "jwk", keyOps( k_exp_dsa_pri, [ "deriveKey", "deriveBits" ] ),
        dh, true, [ "deriveKey", "deriveBits" ] );
    console.log( "IMP DH PRI",  k_imp_dh_pri );

    const bits_ig = await WCS.deriveBits(
        Object.assign( {}, dh, { public: k_imp_dh_pub } ), k_gen_dh.privateKey, 256 );
    const bits_gi = await WCS.deriveBits(
        Object.assign( {}, dh, { public: k_gen_dh.publicKey } ), k_imp_dh_pri, 256 );


    const k_kdf_ig_imp = await WCS.importKey(
        "raw", bits_ig, { name: "PBKDF2" }, false, [ "deriveKey", "deriveBits" ] );
    const k_kdf_gi_imp = await WCS.importKey(
        "raw", bits_gi, { name: "PBKDF2" }, false, [ "deriveKey", "deriveBits" ] );

    const salt = WC.getRandomValues( new Uint8Array( 16 ) );
    const k_kdf_ig = await WCS.deriveKey(
        { "name": "PBKDF2", salt: salt, iterations: 1, hash: {name: "SHA-1"} },
        k_kdf_ig_imp,
        { name: "AES-CBC", length: 256 }, true, [ "encrypt", "decrypt" ] );
    const k_kdf_gi = await WCS.deriveKey(
        { "name": "PBKDF2", salt: salt, iterations: 1, hash: {name: "SHA-1"} },
        k_kdf_gi_imp,
        { name: "AES-CBC", length: 256 }, true, [ "encrypt", "decrypt" ] );

    const k_exp_kdf_ig = await WCS.exportKey( "jwk", k_kdf_ig );
    console.log( "KDF IG",      k_exp_kdf_ig );
    const k_exp_kdf_gi = await WCS.exportKey( "jwk", k_kdf_gi );
    console.log( "KDF GI",      k_exp_kdf_gi );


    const k_gen_aes_cbc = await WCS.generateKey(
        { name: "AES-CBC", length: 256 }, true, [ "encrypt", "decrypt" ] );
    const k_gen_hmac = await WCS.generateKey(
        { name: "HMAC", hash: { name: "SHA-256" }, length: 256 },
        true, [ "sign", "verify" ] );

    const k_exp_aes_cbc = await WCS.exportKey( "jwk", k_gen_aes_cbc );
    console.log( "EXP AES-CBC", k_exp_aes_cbc );
    const k_exp_hmac = await WCS.exportKey( "jwk", k_gen_hmac );
    console.log( "EXP HMAC",    k_exp_hmac );

    const gcm_key = await WCS.generateKey( { name: "AES-GCM", length: 256, },
                                           true, [ "encrypt", "decrypt" ] );
    const gcm_key_raw = await WCS.exportKey( "raw", gcm_key );
    const gcm_key2_intermediate = await WCS.importKey(
        "raw", gcm_key_raw, { name: "PBKDF2", },
        false, [ "deriveKey", "deriveBits" ] );
    const gcm_key2 = await WCS.deriveKey(
        { "name": "PBKDF2", salt: WC.getRandomValues(new Uint8Array(16)),
          iterations: 1000, hash: { name: "SHA-256"} },
        gcm_key2_intermediate,
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        [ "encrypt", "decrypt" ] );

    const secret = new Uint8Array( 6 );
    secret[ 1 ] = 42;
    const authed = new Uint8Array( 7 );
    authed[ 2 ] = 43;
    const huh = new Uint8Array( 7 );
    huh[ 3 ] = 41;
    const iv = WC.getRandomValues( new Uint8Array( 12 ) );
    const enced = await WCS.encrypt(
        { name: "AES-GCM", iv: iv, additionalData: authed, tagLength: 128 },
        gcm_key, secret );
    try {
        var deced = await WCS.decrypt(
            { name: "AES-GCM", iv: iv, additionalData: authed, tagLength: 128 },
            gcm_key, enced );
        console.log( "HUH",  new Uint8Array( deced ) );
    }
    catch( err ) {
        console.log( "HUH", err.stack );
    }

    try {
        var deced2 = await WCS.decrypt(
            { name: "AES-GCM", iv: iv, additionalData: authed, tagLength: 128 },
            gcm_key2, enced );
    }
    catch( err ) {
        console.log( "VICTORY", typeof( err ), util.inspect( err, { depth:4 } ) );
    }

}

main();

console.log( "key_stuff reached EOF" );
