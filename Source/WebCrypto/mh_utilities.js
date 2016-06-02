/*
 *
 */

var P               = Promise;
var C               = window.crypto.subtle;
var getRandomValues = window.crypto.getRandomValues.bind( window.crypto );
var log             = console.log.bind( console );
var uniqueIdDefaultLength = 5;

function getRandomBytes( num_bytes )
{
    var x = new Uint8Array( num_bytes );
    getRandomValues( x );
    return x;
}

function encodeDecodeFunctions( encoding )
{
    var encoder = new TextEncoder( encoding );
    var decoder = new TextDecoder( encoding );
    var arr = [ encoder.encode.bind( encoder ),
                decoder.decode.bind( decoder ) ];
    return arr;
}


function NameNotAvailableError( message )
{
    this.name    = 'NameNotAvailableError';
    this.message = ( message || '' );
    this.stack   = ( new Error() ).stack;
}
NameNotAvailableError.prototype = Object.create(Error.prototype);
NameNotAvailableError.prototype.constructor = NameNotAvailableError;

function NotFoundError( message )
{
    this.name    = 'NotFoundError';
    this.message = ( message || '' );
    this.stack   = ( new Error() ).stack;
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function RequestError( message, server_msg )
{
    this.name       = 'RequestError';
    this.message    = ( message || '' );
    this.server_msg = ( msg || '' );
    this.stack      = ( new Error() ).stack;
}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;

function ServerError( message, server_msg )
{
    this.name       = 'ServerError';
    this.message    = ( message || '' );
    this.server_msg = ( server_msg || '' );
    this.stack      = ( new Error() ).stack;
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

function AuthenticationError( message )
{
    this.name       = 'AuthenticationError';
    this.message    = ( message || '' );
    this.stack      = ( new Error() ).stack;
}
AuthenticationError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype.constructor = AuthenticationError;

function CryptoError( message )
{
    this.name       = 'CryptoError';
    this.message    = ( message || '' );
    this.stack      = ( new Error() ).stack;
}
CryptoError.prototype = Object.create(Error.prototype);
CryptoError.prototype.constructor = CryptoError;

function VerificationError( message )
{
    this.name       = 'VerificationError';
    this.message    = ( message || '' );
    this.stack      = ( new Error() ).stack;
}
VerificationError.prototype = Object.create(Error.prototype);
VerificationError.prototype.constructor = VerificationError;


function domToCrypto( err ) {
    if( err instanceof DOMException )
    {
        var e = new CryptoError( err.message );
        e.stack = err.stack;
        return Promise.reject( e );
    }
    else
        return Promise.reject( err );
}


/* Encode a typed buffer as a string using only hex characters
 * (could be more efficient with base 64 or whatever) */
function bufToHex( buf )
{
    /* assert( buf is a typed array ) */
    var bytes = new Uint8Array( buf );
    var hex = '';
    for( var i = 0; i < bytes.length; i++ )
    {
        var n = bytes[i].toString( 16 );
        if( n.length < 1 || n.length > 2 )
        {
            throw 'blah';
        }
        if( n.length == 1 )
        {
            n = '0'+n;
        }
        hex += n;
    }
    /* assert( hex.length == 2 * bytes.length ) */
    return hex;
}

function hexToBuf( hex )
{
    /* assert( hex is a string ) */
    /* assert( hex.length % 2 == 0 ) */
    var num_bytes = hex.length / 2;
    var buf = new Uint8Array( num_bytes );
    for( var i = 0; i < num_bytes; i++ )
    {
        buf[i] = parseInt( hex.slice( 2 * i, 2 * i + 2 ), 16 );
    }
    return buf;
}

function makeUniqueId( ids, len )
{
    var id;
    var found = false;
    if( !len )
    {
        len = uniqueIdDefaultLength;
    }
    while( !found )
    {
        id = bufToHex( getRandomBytes( len ) );
        if( !( id in ids ) )
            found = true;
    }
    return id;
}

function unhandledError( msg, err )
{
    log( 'Unhandled error', msg, err );
    alert( 'Unhandled error', msg );
    return P.reject( err );
}

function array_zip( a1, a2, flatten1, flatten2, strict1, strict2 )
{
    log( 'zip', a1, a2 );
    function helper( a, i )
    {
        var result = null;
        if( flatten1 )
        {
            if( Array.isArray( a ) )
            {
                result = a;
            }
            else if( strict1 )
            {
                throw new Error( 'Fix me' );
            }
            else
            {
                result = [ a ];
            }
        }
        else
        {
            result = [ a ];
        }
        if( flatten2 )
        {
            if( Array.isArray( a2[i] ) )
            {
                result = result.concat( a2[i] );
            }
            else if( strict1 )
            {
                throw new Error( 'Fix me' );
            }
            else
            {
                result.push( a2[i] );
            }
        }
        else
        {
            result.push( a2[i] );
        }
        return result;
    }
    return a1.map( helper );
}

function typedArrayConcat( a, b )
{
    a = new Uint8Array( a );
    b = new Uint8Array( b );
    var c = new Uint8Array( a.length + b.length );
    c.set( a );
    c.set( b, a.length );
    return c;
}

function p_all_resolve( promises, values )
{
    /* assert( Array.isArray( promises ) ) */
    /* assert( Array.isArray( values ) ) */
    /* assert( forall i. typeof( promises[i] ) is Promise ) */
    var resolve = P.resolve.bind( P );
    return P.all( promises.concat( values.map( resolve ) ) );
}

/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';
