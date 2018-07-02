/* Top Matter */

/*
 *
 */

import * as M    from "../Utilities/misc";
import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
export const CS = WC.subtle;

export const getRandomValues = WC.getRandomValues.bind( WC );

// WC.generateKey( signing_kalgo, true, [ 'sign', 'verify
// WC.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );

const UNIQUE_ID_DEFAULT_LEN = 5;
const SALT_NUM_BYTES = 128;
const SIG_LENGTH = 132;
const PBKDF2_ITER = 1000;

const signing_kalgo = { name: 'ECDSA', namedCurve: 'P-521' };
const signing_salgo = { name: 'ECDSA', hash: { name:'SHA-256' } };
const pub_enc_algo  = { name: 'ECDH', namedCurve: 'P-521' };
const dh_algo       = { name: 'ECDH', namedCurve: 'P-521' };
const sym_enc_algo  = { name: 'AES-CBC', length: 256  };

const zeros = Buffer.alloc( 16 );

export function getRandomBytes( num_bytes )
{
    const x = Buffer.allocUnsafe( num_bytes );
    getRandomValues( x );
    return x;
}

const pbkdf_algo = function pbkdf_algo( salt )
{
    return { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITER, hash: { name: 'SHA-1' } };
};

const makeUniqueId = function makeUniqueId( ids, len = UNIQUE_ID_DEFAULT_LEN )
{
    var id;
    while( true )
    {
        id = getRandomBytes( len ).toString( "base64" );
        if( !( id in ids ) )
            break;
    }
    return id;
};

const exportKeyJwk = async function exportKeyJwk( k )
{
    return JSON.stringify( await WC.exportKey( 'jwk', k ) );
};

const importKeyJwk = async function importKeyJwk( s, algo, ops )
{
    // assert( typeof( s )    == raw key buffer )
    // assert( typeof( algo ) == crypto algorithm )
    // assert( typeof( ops )  == sequence of supported operations )

    const j = JSON.parse( s );
    return await WC.importKey( 'jwk', j, algo, true, ops );
};

const importKeyPubDH = function importKeyPubDH( k, scp )
{ return importKeyJwk( k, pub_enc_algo, [], scp ); };
const importKeyPrivDH = function importKeyPrivDH( k, scp )
{ return importKeyJwk( k, pub_enc_algo, [ 'deriveKey' ], scp ); };
const importKeyVerify = function importKeyVerify( k, scp )
{ return importKeyJwk( k, signing_kalgo, [ 'verify' ], scp ); };
const importKeySign = function importKeySign( k, scp )
{ return importKeyJwk( k, signing_kalgo, [ 'sign' ], scp ); };
const importKeySym = function importKeySym( k, scp )
{ return importKeyJwk( k, sym_enc_algo, [ 'encrypt', 'decrypt' ], scp ); };

// Encode and pack strings into a byte array
const stringsToBuf = function stringsToBuf( strings )
{
    // assert( Array.isArray( strings ) )
    // assert( forall i. typeof( strings[i] ) == 'string' )
    var bufs = [];
    var total_bytes = 0;
    strings.forEach( function( s, i ) {
        bufs.push( encode( s ) );
        total_bytes += bufs[ i ].length;
    } );
    var b = new Uint8Array( total_bytes );
    var byte_ptr = 0;
    for( var i = 0; i < bufs.length; i++ )
    {
        b.set( bufs[i], byte_ptr );
        byte_ptr += bufs[i].length;
    }
    return b;
};

const makeLoginKey = async function makeLoginKey( username, password, salt )
{
    // assert( typeof( username ) == 'string' )
    // assert( typeof( password ) == 'string' )
    // assert( typeof( salt ) == typed array )
    var up = stringsToBuf( [ username, password ] );
    return WC.deriveKey(
        pbkdf_algo( salt ),
        await WC.importKey( 'raw', up, { name: 'PBKDF2' }, false, [ 'deriveKey' ] ),
        sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
};

const ecdh_aesDeriveKey = function ecdh_aesDeriveKey( pub, priv )
{
    return WC.deriveKey(
        { name: 'ECDH', namedCurve: 'P-521', public: pub }, priv,
        { name: 'AES-CBC', length: 256 }, true, [ 'encrypt', 'decrypt' ] );
};

function CryptoSpecificAlgos( enc_algo, sign_algo, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'CryptoSpecificAlgos' );
    log( enc_algo, sign_algo );
    this.enc_algo   = enc_algo;
    this.sign_algo  = sign_algo;
    this.sig_length = SIG_LENGTH;
    this.iv_length  = 16;
}

const cryptoSpecificAlgos = function cryptoSpecificAlgos(
    enc_algo,
    sign_algo,
    sig_length = SIG_LENGTH,
    iv_length = 16 )
{
    const encryptThenSign = async function encryptThenSign(
        key_enc, key_sign, data, enc_param )
    {
        try {
            var data_enc = await WC.encrypt( this.enc_algo( enc_param ), key_enc, data );
            var sig = await WC.sign( this.sign_algo(), key_sign, data_enc );
            return typedArrayConcat( sig, data_enc );
        }
        catch( err ) {
            domToCrypto( err );
        }
    };

    const verifyThenDecrypt = async function verifyThenDecrypt(
        key_dec, key_ver, sig_plus_data, enc_param )
    {
        try {
            var d_as_bytes = new Uint8Array( sig_plus_data );
            var sig = d_as_bytes.subarray( 0, this.sig_length );
            var data_enc = d_as_bytes.subarray( this.sig_length );
            if( !( await WC.verify( this.sign_algo(), key_ver, sig, data_enc ) ) )
                throw new VerificationError( '', scp );
            // 'else'
            return WC.decrypt( this.enc_algo( enc_param ), key_dec, data_enc );
        }
        catch( err ) {
            domToCrypto( err );
        }
    };

    const decryptSkipVerify = async function decryptSkipVerify(
        key_dec, sig_plus_data, enc_param )
    {
        try {
            var data_enc = ( new Uint8Array( sig_plus_data ) ).subarray( this.sig_length );
            return await WC.decrypt( this.enc_algo( enc_param ), key_dec, data_enc )
        }
        catch( err ) {
            domToCrypto( err );
        }
    };

    const encryptThenSignSalted = function encryptThenSignSalted(
        key_enc, key_sign, data )
    {
        return encryptThenSign(
            scp, key_enc, key_sign, typedArrayConcat( getRandomBytes( this.iv_length ), data ),
            zeros );
    };

    const verifyThenDecryptSalted = async function verifyThenDecryptSalted(
        key_dec, key_ver, data )
    {
        const bytes = await this.verifyThenDecrypt( null, key_dec, key_ver, data, zeros )
        return new Uint8Array( bytes ).subarray( this.iv_length );
    };

    const decryptSkipVerifySalted = async function decryptSkipVerifySalted(
        key_dec, data )
    {
        const salt_plus_data = await this.decryptSkipVerify( key_dec, data, zeros );
        // log( new Uint8Array( salt_plus_data ), this.iv_length );
        return ( new Uint8Array( salt_plus_data ) ).subarray( this.iv_length );
    };

    return { encryptThenSign, verifyThenDecrypt, decryptSkipVerify, encryptThenSignSalted,
             verifyThenDecryptSalted, decryptSkipVerifySalted };
};

export const aes_cbc_ecdsa = cryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'ECDSA', hash: { name:'SHA-256' } }; }
);

export const aes_cbc_hmac = cryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'HMAC' }; }
);

export function digest_sha_512( data )
{
    if( typeof( data ) === "string" )
    {
        data = M.encode( data );
    }
    /* assert( typeof( data ) is { ArrayBuffer or ArrayBufferView } ) */
    return CS.digest( { name: "SHA-512" }, data );
}
