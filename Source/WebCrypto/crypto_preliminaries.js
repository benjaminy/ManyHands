var signing_kalgo = { name: 'ECDSA', namedCurve: 'P-521' };
var signing_salgo = { name: 'ECDSA', hash: { name:'SHA-256' } };
var pub_enc_algo  = { name: 'ECDH', namedCurve: 'P-521' };
var sym_enc_algo  = { name: 'AES-CBC', length: 256  };

function importKeyEncrypt( k )
{ return C.importKey( 'jwk', JSON.parse( k ),  pub_enc_algo, true, [] ); }
function importKeyDecrypt( k )
{ return C.importKey( 'jwk', JSON.parse( k ),  pub_enc_algo, true, [ 'deriveKey' ] ); }
function importKeyVerify( k )
{ return C.importKey( 'jwk', JSON.parse( k ), signing_kalgo, true, [ 'verify' ] ); }
function importKeySign( k )
{ return C.importKey( 'jwk', JSON.parse( k ), signing_kalgo, true, [ 'sign' ] ); }
function importKeySym( k )
{ return C.importKey( 'jwk', JSON.parse( k ),  sym_enc_algo, true, [ 'encrypt', 'decrypt' ] ); }

function encrypt_and_sign( e_algo, s_algo, e_key, s_key, d )
{
    /* log( '[Debug]', d ); */
    return C.encrypt( e_algo, e_key, d )
    .then( function( m ) {
        return P.all( [ C.sign( s_algo, s_key, m ), P.resolve( m ) ] );
    } ).then( function( [ s, m ] ) {
        return P.resolve( typedArrayConcat( s, m ) );
    } ).catch( domToCrypto );
}

function verify_and_decrypt( e_algo, s_algo, e_key, s_key, d, s_bytes )
{
    var d_as_bytes = new Uint8Array( d );
    var s = d_as_bytes.subarray( 0, s_bytes );
    var m = d_as_bytes.subarray( s_bytes );
    return C.verify( s_algo, s_key, s, m )
    .then( function( v ) {
        if( !v )
            return P.reject( new VerificationError() );
        /* 'else' */
        return C.decrypt( e_algo, e_key, m );
    } ).catch( domToCrypto );
}

function encrypt_and_sign_ac_ed( e_key, s_key, iv, d )
{
    return encrypt_and_sign(
        { name: 'AES-CBC', iv: iv },
        { name: 'ECDSA', hash: { name:'SHA-256' } },
        e_key, s_key, d );
}

function verify_and_decrypt_ac_ed( e_key, s_key, iv, d )
{
    return P.all( [ C.exportKey( 'jwk', e_key ), C.exportKey( 'jwk', s_key ) ] )
    .then( function( [ e, s ] ) {
        var d8 = new Uint8Array( d )
        /*
        log( 'V AND D e:', e );
        log( 'V AND D s:', s );
        log( 'V AND D i:', new Uint8Array( iv ) );
        log( 'V AND D d:', typeof( d ), d8.length, d.byteLength, d8 ); */
        return P.resolve();
    } ).then( function( _ ) {
        return verify_and_decrypt(
        { name: 'AES-CBC', iv: iv },
        { name: 'ECDSA', hash: { name:'SHA-256' } },
        e_key, s_key, d, SIG_LENGTH );

    } );
}

function encrypt_aes_cbc( iv, k, d )
{
    return C.encrypt( { name: 'AES-CBC', iv: iv }, k, d )
    .then( function( v ) {
        return P.resolve( v );
    },
    function( err ) {
        if( err instanceof DOMException )
            return P.reject( new CryptoError() );
        else
            return P.reject( err );
    } );
}

function decrypt_aes_cbc( iv, k, d )
{
    return C.decrypt( { name: 'AES-CBC', iv: iv }, k, d )
    .then( function( v ) {
        return P.resolve( v );
    },
    function( err ) {
        if( err instanceof DOMException )
            return P.reject( new CryptoError() );
        else
            return P.reject( err );
    } );
}

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
        return C.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITER, hash: { name: 'SHA-1' }, },
            k, sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } );
}
