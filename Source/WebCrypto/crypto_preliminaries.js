var SALT_NUM_BYTES = 128;
var SIG_LENGTH = 132;
var PBKDF2_ITER = 1000;

var signing_kalgo = { name: 'ECDSA', namedCurve: 'P-521' };
var signing_salgo = { name: 'ECDSA', hash: { name:'SHA-256' } };
var pub_enc_algo  = { name: 'ECDH', namedCurve: 'P-521' };
var sym_enc_algo  = { name: 'AES-CBC', length: 256  };

function pbkdf_algo( salt )
{ return { name: 'PBKDF2', salt: salt, iterations: 1000, hash: { name: 'SHA-1' } }; }


/* TODO: zeros is used as the IV in too many encryptions. */
var zeros = new Uint8Array( 16 );

function importKeyJwk( k, algo, ops, log_ctx )
{
    try
    {
        return C.importKey( 'jwk', JSON.parse( k ),  algo, true, ops );
    }
    catch( e )
    {
        log( log_ctx, 'Import failed', k );
        throw e;
    }
}

function importKeyEncrypt( k )
{ return importKeyJwk( k, pub_enc_algo, [] ); }
function importKeyDecrypt( k )
{ return importKeyJwk( k, pub_enc_algo, [ 'deriveKey' ] ); }
function importKeyVerify( k )
{ return importKeyJwk( k, signing_kalgo, [ 'verify' ] ); }
function importKeySign( k )
{ return importKeyJwk( k, signing_kalgo, [ 'sign' ] ); }
function importKeySym( k, log_ctx )
{ return importKeyJwk( k, sym_enc_algo, [ 'encrypt', 'decrypt' ] ); }

/* Encode and pack strings into a byte array */
function stringsToBuf( strings )
{
    /* assert( Array.isArray( strings ) ) */
    /* assert( forall i. typeof( strings[i] ) == 'string' ) */
    var bufs = [];
    var total_bytes = 0;
    for( var i = 0; i < strings.length; i++ )
    {
        bufs.push( encode( strings[ i ] ) );
        total_bytes += bufs[ i ].length;
    }
    var b = new Uint8Array( total_bytes );
    var byte_ptr = 0;
    for( var i = 0; i < bufs.length; i++ )
    {
        b.set( bufs[i], byte_ptr );
        byte_ptr += bufs[i];
    }
    return b;
}

function makeLoginKey( username, password, salt )
{
    /* assert( typeof( username ) == 'string' ) */
    /* assert( typeof( password ) == 'string' ) */
    /* assert( typeof( salt ) == typed array ) */
    var up = stringsToBuf( [ username, password ] );
    return C.importKey( 'raw', up, { name: 'PBKDF2' }, true, [ 'deriveKey' ]
    ).then( function( k ) {
        return C.deriveKey( pbkdf_algo( salt ), k, sym_enc_algo,
                            true, [ 'encrypt', 'decrypt' ] );
    } );
}

function ecdh_aesDeriveKey( pub, priv )
{
    return C.deriveKey(
        { name: 'ECDH', namedCurve: 'P-521', public: pub }, priv,
        { name: 'AES-CBC', length: 256 }, true, [ 'encrypt', 'decrypt' ] );
}

function CryptoSpecificAlgos( enc_algo, sign_algo, log_ctx )
{
    log( 'CryptoSpecificAlgos constructor', log_ctx, enc_algo, sign_algo );
    this.enc_algo   = enc_algo;
    this.sign_algo  = sign_algo;
    this.sig_length = SIG_LENGTH;
    this.iv_length  = 16;
}

CryptoSpecificAlgos.prototype.encrypt_then_sign =
function( key_enc, key_sign, data, enc_param, log_ctx )
{
    if( log_ctx ) log_ctx.push( 'encrypt_then_sign' );
    // log( log_ctx, "encrypt_then_sign 1" );
    return C.encrypt( this.enc_algo( enc_param ), key_enc, data )
    .then( function( data_enc ) {
        log( log_ctx, "encrypt_then_sign 2", key_sign );
        return P.all( [ C.sign( this.sign_algo(), key_sign, data_enc ), P.resolve( data_enc ) ] );
    }.bind( this ) ).then( function( [ sig, data_enc ] ) {
        // log( log_ctx, "encrypt_then_sign 3", sig.byteLength );
        return P.resolve( typedArrayConcat( sig, data_enc ) );
    }.bind( this ) ).catch( domToCrypto );
}

CryptoSpecificAlgos.prototype.verify_then_decrypt =
function( key_dec, key_ver, sig_plus_data, enc_param )
{
    /* log( '[Debug]', ... )*/
    var d_as_bytes = new Uint8Array( sig_plus_data );
    var sig = d_as_bytes.subarray( 0, this.sig_length );
    var data_enc = d_as_bytes.subarray( this.sig_length );
    var err = new VerificationError();
    return C.verify( this.sign_algo(), key_ver, sig, data_enc )
    .then( function( signature_ok ) {
        if( !signature_ok )
            return P.reject( err );
        /* 'else' */
        return C.decrypt( this.enc_algo( enc_param ), key_dec, data_enc );
    }.bind( this ) ).catch( domToCrypto );
}

CryptoSpecificAlgos.prototype.decrypt_skip_verify =
function( key_dec, sig_plus_data, enc_param )
{
    /* log( '[Debug]', ... )*/
    var data_enc = ( new Uint8Array( sig_plus_data ) ).subarray( this.sig_length );
    return C.decrypt( this.enc_algo( enc_param ), key_dec, data_enc )
    .catch( domToCrypto );
}

CryptoSpecificAlgos.prototype.encrypt_then_sign_salted =
function( key_enc, key_sign, data, log_ctx )
{
    // log( 'encrypt_then_sign_salted', log_ctx, key_enc, key_sign, data );
    return this.encrypt_then_sign(
        key_enc, key_sign, typedArrayConcat( getRandomBytes( this.iv_length ), data ),
        zeros, log_ctx );
}

CryptoSpecificAlgos.prototype.verify_then_decrypt_salted =
function( key_dec, key_ver, data )
{
    return this.verify_then_decrypt( key_dec, key_ver, data, zeros )
    .then( function( salt_plus_data ) {
        return P.resolve( new Uint8Array( salt_plus_data ).subarray( this.iv_length ) );
    }.bind( this ) );
}

CryptoSpecificAlgos.prototype.decrypt_skip_verify_salted =
    function( key_dec, data, log_ctx )
{
    return this.decrypt_skip_verify( key_dec, data, zeros )
    .then( function( salt_plus_data ) {
        log( 'Decrypt', log_ctx, new Uint8Array( salt_plus_data ), this.iv_length );
        return P.resolve( ( new Uint8Array( salt_plus_data ) ).subarray( this.iv_length ) );
    }.bind( this ) );
}

var aes_cbc_ecdsa = new CryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'ECDSA', hash: { name:'SHA-256' } }; }
);

var aes_cbc_hmac = new CryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'HMAC' }; }
);
