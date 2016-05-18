/*
 *
 */

var P         = Promise;
var C         = window.crypto.subtle;
var getRandomValues = window.crypto.getRandomValues.bind( window.crypto );
var log       = console.log.bind( console );
var getElemId = document.getElementById.bind( document );

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

function AuthenticationError( message, authentication_msg )
{
    this.name       = 'AuthenticationError';
    this.message    = ( message || '' );
    this.stack      = ( new Error() ).stack;
}
AuthenticationError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype.constructor = AuthenticationError;


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

/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';

