/*
 * Top Matter
 */

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
    const k_exp_kdf_gi = await WCS.exportKey( "jwk", k_kdf_gi );

    const k_gen_aes_cbc = await WCS.generateKey(
        { name: "AES-CBC", length: 256 }, true, [ "encrypt", "decrypt" ] );
    const k_gen_hmac = await WCS.generateKey(
        { name: "HMAC", hash: { name: "SHA-256" }, length: 256 },
        true, [ "sign", "verify" ] );

    const k_exp_aes_cbc = await WCS.exportKey( "jwk", k_gen_aes_cbc );
    const k_exp_hmac = await WCS.exportKey( "jwk", k_gen_hmac );

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
    console.log( "KDF IG",      k_exp_kdf_ig );
    console.log( "KDF GI",      k_exp_kdf_gi );
    console.log( "EXP AES-CBC", k_exp_aes_cbc );
    console.log( "EXP HMAC",    k_exp_hmac );
}

main();

console.log( "key_stuff reached EOF" );
