var SALT_NUM_BYTES = 128;
var SIG_LENGTH = 132;
var PBKDF2_ITER = 1000;

var signing_kalgo = { name: 'ECDSA', namedCurve: 'P-521' };
var signing_salgo = { name: 'ECDSA', hash: { name:'SHA-256' } };
var pub_enc_algo  = { name: 'ECDH', namedCurve: 'P-521' };
var sym_enc_algo  = { name: 'AES-CBC', length: 256  };

function pbkdf_algo( salt )
{ return { name: 'PBKDF2', salt: salt, iterations: 1000, hash: { name: 'SHA-1' } }; }


var zeros = new Uint8Array( 16 );

function exportKeyJwk( k )
{
    return C.exportKey( 'jwk', k )
    .then( function( j ) {
        return P.resolve( JSON.stringify( j ) );
    } );
}

function importKeyJwk( s, algo, ops, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'ImportKey' );
    /* s is a string in JSON format */
    var j;
    try
    {
        j = JSON.parse( s );
    }
    catch( e )
    {
        log( 'Not JSON', s );
        throw e;
    }
    return C.importKey( 'jwk', j, algo, true, ops );
}

function importKeyPubDH( k, scp )
{ return importKeyJwk( k, pub_enc_algo, [], scp ); }
function importKeyPrivDH( k, scp )
{ return importKeyJwk( k, pub_enc_algo, [ 'deriveKey' ], scp ); }
function importKeyVerify( k, scp )
{ return importKeyJwk( k, signing_kalgo, [ 'verify' ], scp ); }
function importKeySign( k, scp )
{ return importKeyJwk( k, signing_kalgo, [ 'sign' ], scp ); }
function importKeySym( k, scp )
{ return importKeyJwk( k, sym_enc_algo, [ 'encrypt', 'decrypt' ], scp ); }

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

function CryptoSpecificAlgos( enc_algo, sign_algo, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'CryptoSpecificAlgos' );
    log( enc_algo, sign_algo );
    this.enc_algo   = enc_algo;
    this.sign_algo  = sign_algo;
    this.sig_length = SIG_LENGTH;
    this.iv_length  = 16;
}

CryptoSpecificAlgos.prototype.encrypt_then_sign =
function( key_enc, key_sign, data, enc_param, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'encrypt_then_sign' );
    // log( "1" );
    return C.encrypt( this.enc_algo( enc_param ), key_enc, data )
    .then( function( data_enc ) {
        // log( "2", key_sign );
        return P.all( [ C.sign( this.sign_algo(), key_sign, data_enc ), P.resolve( data_enc ) ] );
    }.bind( this ) ).then( function( [ sig, data_enc ] ) {
        // log( "3", sig.byteLength );
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
function( key_enc, key_sign, data, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'encrypt_then_sign_salted' );
    // log( key_enc, key_sign, data );
    return this.encrypt_then_sign(
        key_enc, key_sign, typedArrayConcat( getRandomBytes( this.iv_length ), data ),
        zeros, scp );
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
    function( key_dec, data, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Decrypt' );
    return this.decrypt_skip_verify( key_dec, data, zeros )
    .then( function( salt_plus_data ) {
        log( new Uint8Array( salt_plus_data ), this.iv_length );
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
