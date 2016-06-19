/*
 *
 */

var P               = Promise;
var C               = window.crypto.subtle;
var getRandomValues = window.crypto.getRandomValues.bind( window.crypto );
var uniqueIdDefaultLength = 5;

var encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

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

/* stupid Firefox */
function polyfill_captureStackTrace( o, c )
{
    if( Error.captureStackTrace )
    {
        return Error.captureStackTrace( o, c );
    }
    else
    {
        /* TODO */
    }
}

function AssertionFailedError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message = ( message || '' );
}
AssertionFailedError.prototype = Object.create(Error.prototype);
AssertionFailedError.prototype.constructor = AssertionFailedError;

function NameNotAvailableError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message = ( message || '' );
}
NameNotAvailableError.prototype = Object.create(Error.prototype);
NameNotAvailableError.prototype.constructor = NameNotAvailableError;

function NotFoundError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message = ( message || '' );
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function RequestError( message, server_msg )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message    = ( message || '' );
    this.server_msg = ( server_msg || '' );
}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;

function ServerError( message, server_msg )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message    = ( message || '' );
    this.server_msg = ( server_msg || '' );
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

function AuthenticationError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message    = ( message || '' );
}
AuthenticationError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype.constructor = AuthenticationError;

function CryptoError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message    = ( message || '' );
}
CryptoError.prototype = Object.create(Error.prototype);
CryptoError.prototype.constructor = CryptoError;

function VerificationError( message )
{
    Error.call( this );
    polyfill_captureStackTrace( this, this.constructor );
    this.name = this.constructor.name;
    this.message    = ( message || '' );
}
VerificationError.prototype = Object.create(Error.prototype);
VerificationError.prototype.constructor = VerificationError;

function assert( condition, message )
{
    if( condition )
        return;
    throw new AssertionFailedError( message );
}

function domToCrypto( err ) {
    if( err instanceof DOMException )
    {
        throw new CryptoError( err.message );
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

function hexToBuf( hex, scp )
{
    /* assert( hex is a string ) */
    /* assert( hex.length % 2 == 0 ) */
    var [ scp, log ] = Scope.enter( scp, 'hexToBuf' );
    var num_bytes = hex.length / 2;
    var buf = new Uint8Array( num_bytes );
    for( var i = 0; i < num_bytes; i++ )
    {
        buf[i] = parseInt( hex.slice( 2 * i, 2 * i + 2 ), 16 );
    }
    log( 'blah', buf );
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

function array_zip( a1, a2, flatten1, flatten2, strict1, strict2, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'array_zip' );
    log( a1, a2 );
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

function p_all_resolve( promises, values, scp )
{
    /* assert( Array.isArray( promises ) ) */
    /* assert( Array.isArray( values ) ) */
    /* assert( forall i. typeof( promises[i] ) is Promise ) */
    return P.all( promises.concat( values.map( P.resolve.bind( P ) ) ) );
}

function handleServerError( url, resp )
{
    return new Promise( function( resolve, reject ) {
        var msg = url+' '+resp.statusText + ' ';
        if( resp.status >= 400 && resp.status < 500 )
            return resp.text().then( function( t ) {
                reject( new RequestError( msg + t ) );
            } );
        else
            return resp.text().then( function( t ) {
                reject( new ServerError( msg + t ) );
            } );
    } );
}


/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';

