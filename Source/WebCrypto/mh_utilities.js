/*
 *
 */

var P = Promise;

var encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

function getRandomBytes( num_bytes )
{
    var x = new Uint8Array( num_bytes );
    getRandomValues( x );
    return x;
}

var randomName = function( num_chars, encoding, prefix, suffix )
{
    var NUM_CHARS      = num_chars | 18;
    var ENCODING       = encoding  | 'base32crock';
    var PREFIX         = prefix    | 'F';
    var SUFFIX         = suffix    | '.data';
    var ALPHABETS      = {
        base32crock : '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    };
    var ALPHABET       = ALPHABETS[ encoding ];
    var NUM_CHARS      = ALPHABET.length;
    var WORD_SIZE      = 32;
    var CHARS_PER_WORD = 6; /* XXX should be computed from WORD_SIZE and NUM_CHARS */
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

function AbstractError( err, msg, scp )
{
    Error.call( err );
    polyfill_captureStackTrace( err, err.constructor );
    if( scp )
    {
        var stacks = scp.old_stacks.concat( err.stack );
        err.stack = stacks.join();
    }
    err.name = err.constructor.name;
    err.message = ( msg || '' );
}

function AssertionFailedError( msg, scp )
{
    AbstractError( this, msg, scp );
}
AssertionFailedError.prototype = Object.create(Error.prototype);
AssertionFailedError.prototype.constructor = AssertionFailedError;

function NameNotAvailableError( msg, scp )
{
    AbstractError( this, msg, scp );
}
NameNotAvailableError.prototype = Object.create(Error.prototype);
NameNotAvailableError.prototype.constructor = NameNotAvailableError;

function NotFoundError( msg, scp )
{
    AbstractError( this, msg, scp );
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function RequestError( msg, server_msg, scp )
{
    AbstractError( this, msg, scp );
    this.server_msg = ( server_msg || '' );
}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;

function ServerError( msg, server_msg, scp )
{
    AbstractError( this, msg, scp );
    this.server_msg = ( server_msg || '' );
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

function AuthenticationError( msg, scp )
{
    AbstractError( this, msg, scp );
}
AuthenticationError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype.constructor = AuthenticationError;

function CryptoError( msg, scp )
{
    AbstractError( this, msg, scp );
}
CryptoError.prototype = Object.create(Error.prototype);
CryptoError.prototype.constructor = CryptoError;

function VerificationError( msg, scp )
{
    AbstractError( this, msg, scp );
}
VerificationError.prototype = Object.create(Error.prototype);
VerificationError.prototype.constructor = VerificationError;

function assert( condition, message, scp )
{
    if( condition )
        return;
    throw new AssertionFailedError( message, scp );
}

function domToCrypto( err, scp ) {
    if( err instanceof DOMException )
    {
        throw new CryptoError( err.message, scp );
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

function async_handle( generator )
{
    function handle( result )
    {
        if( result.done )
            return P.resolve( result.value );
        /* else: */
        return Promise.resolve( result.value ).then(
            function( res )
            { return handle( generator.next( res ) ) },
            function( err )
            { return handle( generator.throw( err ) ) } );
    }
    try {
        return handle( generator.next() );
    }
    catch( err ) {
        return P.reject( err );
    }
}

/* 'this' is the last parameter, because it is not aupplied in non-OO contexts */
function async( name, makeGen, this_param )
{
    /* name: string */
    /* makeGen: function generator of type A -> [ B, C, D ] α */
    return function( scp, ...params )
    {
        var [ scp, log ] = Scope.enter( scp, name );
        return async_handle( makeGen.bind( this_param )( scp, log, ...params ) );
    }
}

function async_no_scp( makeGen, this_param )
{
    /* name: string */
    /* makeGen: function generator of type A -> [ B, C, D ] α */
    return function( ...params )
    {
        return async_handle( makeGen.bind( this_param )( ...params ) );
    }
}

function async_local( scp, name, makeGen, this_param )
{
    /* name: string */
    /* makeGen: function generator of type A -> [ B, C, D ] α */
    return function( ...params )
    {
        var [ scp, log ] = Scope.enter( scp, name );
        return async_handle( makeGen.bind( this_param )( scp, log, ...params ) );
    }
}

var handleServerError = async( null, function *( scp, log, msg, resp )
{
    if( resp.status == 404 )
        throw new NotFoundError( msg, scp );
    var t = yield resp.text();
    if( resp.status >= 400 && resp.status < 500 )
        throw new RequestError( msg, resp.statusText + ' ' + t, scp );
    throw new ServerError( msg, resp.statusText + ' ' + t, scp );
} );

/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';

