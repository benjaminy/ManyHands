/*
 * Top Matter
 */

import assert  from "../Source/Utilities/assert";
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
    const k_gen_dh  = await WCS.generateKey(  dh, true, [ "deriveKey", "deriveBits" ] );

    const k_exp_dsa_pub = await WCS.exportKey( "jwk", k_gen_dsa.publicKey );
    const k_exp_dsa_pri = await WCS.exportKey( "jwk", k_gen_dsa.privateKey );
    const k_exp_dh_pub  = await WCS.exportKey( "jwk", k_gen_dh.publicKey );
    const k_exp_dh_pri  = await WCS.exportKey( "jwk", k_gen_dh.privateKey );

    const k_imp_dsa_pub = await WCS.importKey(
        "jwk", keyOps( k_exp_dh_pub, [ "verify" ] ), dsa, true, [ "verify" ] );
    const k_imp_dsa_pri = await WCS.importKey(
        "jwk", keyOps( k_exp_dh_pri, [ "sign" ] ), dsa, true, [ "sign" ] );
    const k_imp_dh_pub = await WCS.importKey(
        "jwk", keyOps( k_exp_dsa_pub, [ ] ), dh, true, [ ] );
    const k_imp_dh_pri = await WCS.importKey(
        "jwk", keyOps( k_exp_dsa_pri, [ "deriveKey", "deriveBits" ] ),
        dh, true, [ "deriveKey", "deriveBits" ] );

    const bits_der = await WCS.deriveBits(
        Object.assign( {}, dh, { public: k_imp_dh_pub } ), k_imp_dh_pri, 256 );
    const k_kdf_imp = await WCS.importKey(
        "raw", bits_der, { name: "PBKDF2", }, false, [ "deriveKey", "deriveBits" ] );
    const salt = WC.getRandomValues( new Uint8Array( 16 ) );
    const k_kdf = await WCS.deriveKey(
        { "name": "PBKDF2", salt: salt, iterations: 1, hash: {name: "SHA-1"}, },
        k_kdf_imp,
        { name: "AES-CBC", length: 256, },
        false,
        [ "encrypt", "decrypt" ] );

    console.log( "GEN DSA",     k_gen_dsa );
    console.log( "GEN DH",      k_gen_dh );
    console.log( "EXP DSA PUB", k_exp_dsa_pub );
    console.log( "EXP DSA PRI", k_exp_dsa_pri );
    console.log( "EXP DH PUB",  k_exp_dh_pub );
    console.log( "EXP DH PRI",  k_exp_dh_pri );
    console.log( "IMP DSA PUB", k_imp_dsa_pub );
    console.log( "IMP DSA PRI", k_imp_dsa_pri );
    console.log( "IMP DH PUB",  k_imp_dh_pub );
    console.log( "IMP DH PRI",  k_imp_dh_pri );
    console.log( "BITS",        bits_der );
    console.log( "KDF",         k_kdf );
}

main();

console.log( "key_stuff reached EOF" );
