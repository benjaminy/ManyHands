var C               = window.crypto.subtle;
var getRandomValues = window.crypto.getRandomValues.bind( window.crypto );

var UNIQUE_ID_DEFAULT_LEN = 5;
var SALT_NUM_BYTES = 128;
var SIG_LENGTH = 132;
var PBKDF2_ITER = 1000;

var signing_kalgo = { name: 'ECDSA', namedCurve: 'P-521' };
var signing_salgo = { name: 'ECDSA', hash: { name:'SHA-256' } };
var pub_enc_algo  = { name: 'ECDH', namedCurve: 'P-521' };
var sym_enc_algo  = { name: 'AES-CBC', length: 256  };

var zeros = new Uint8Array( 16 );

function pbkdf_algo( salt )
{ return { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITER, hash: { name: 'SHA-1' } }; }

function makeUniqueId( ids, len )
{
    var id;
    var found = false;
    if( !len )
    {
        len = UNIQUE_ID_DEFAULT_LEN;
    }
    while( !found )
    {
        id = bufToHex( getRandomBytes( len ) );
        if( !( id in ids ) )
            found = true;
    }
    return id;
}

var exportKeyJwk = async_no_scp( function *( k )
{
    return JSON.stringify( yield C.exportKey( 'jwk', k ) );
} );

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

var makeLoginKey = async_no_scp( function *( username, password, salt )
{
    /* assert( typeof( username ) == 'string' ) */
    /* assert( typeof( password ) == 'string' ) */
    /* assert( typeof( salt ) == typed array ) */
    var up = stringsToBuf( [ username, password ] );
    return C.deriveKey(
        pbkdf_algo( salt ),
        yield C.importKey( 'raw', up, { name: 'PBKDF2' }, true, [ 'deriveKey' ] ),
        sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
} );

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

CryptoSpecificAlgos.prototype.encryptThenSign =
function( scp1, key_enc, key_sign, data, enc_param )
{
    return async( 'encryptThenSign', function *( scp, log )
    {
        // log( "1", typeof( this ), this );
        try
        {
            var data_enc = yield C.encrypt( this.enc_algo( enc_param ), key_enc, data );
            // log( "2", key_sign );
            var sig = yield C.sign( this.sign_algo(), key_sign, data_enc );
            // log( "3", sig.byteLength );
            return typedArrayConcat( sig, data_enc );
        }
        catch( err )
        {
            domToCrypto( err );
        }
    }, this )( scp1 );
}

CryptoSpecificAlgos.prototype.verifyThenDecrypt =
function( scp1, key_dec, key_ver, sig_plus_data, enc_param )
{
    return async( 'verifyThenDecrypt', function *( scp, log )
    {
        /* log( '[Debug]', ... )*/
        try
        {
            var d_as_bytes = new Uint8Array( sig_plus_data );
            var sig = d_as_bytes.subarray( 0, this.sig_length );
            var data_enc = d_as_bytes.subarray( this.sig_length );
            if( !( yield C.verify( this.sign_algo(), key_ver, sig, data_enc ) ) )
                throw new VerificationError( '', scp );
            /* 'else' */
            return C.decrypt( this.enc_algo( enc_param ), key_dec, data_enc );
        }
        catch( err )
        {
            domToCrypto( err );
        }
    }, this )( scp1 );
}

CryptoSpecificAlgos.prototype.decryptSkipVerify =
function( key_dec, sig_plus_data, enc_param )
{
    /* log( '[Debug]', ... )*/
    var data_enc = ( new Uint8Array( sig_plus_data ) ).subarray( this.sig_length );
    return C.decrypt( this.enc_algo( enc_param ), key_dec, data_enc )
    .catch( domToCrypto );
}

CryptoSpecificAlgos.prototype.encryptThenSignSalted =
function( key_enc, key_sign, data, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'encryptThenSignSalted' );
    // log( key_enc, key_sign, data );
    return this.encryptThenSign(
        scp, key_enc, key_sign, typedArrayConcat( getRandomBytes( this.iv_length ), data ),
        zeros );
}

CryptoSpecificAlgos.prototype.verifyThenDecryptSalted =
function( key_dec, key_ver, data )
{
    return async_no_scp( function *()
    {
        return new Uint8Array(
            yield this.verifyThenDecrypt( null, key_dec, key_ver, data, zeros ) )
                .subarray( this.iv_length );
    }, this )();
}

CryptoSpecificAlgos.prototype.decryptSkipVerifySalted =
function( scp1, key_dec, data )
{
    return async( 'Decrypt', function *( scp, log )
    {
        var salt_plus_data = yield this.decryptSkipVerify( key_dec, data, zeros );
        log( new Uint8Array( salt_plus_data ), this.iv_length );
        return ( new Uint8Array( salt_plus_data ) ).subarray( this.iv_length );
    }, this )( scp1 );
}

var aes_cbc_ecdsa = new CryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'ECDSA', hash: { name:'SHA-256' } }; }
);

var aes_cbc_hmac = new CryptoSpecificAlgos(
    function( iv ) { return { name: 'AES-CBC', iv: iv }; },
    function()     { return { name: 'HMAC' }; }
);
