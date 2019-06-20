/* Top Matter */

const P = Promise;
//import BufferThing from "buffer/";
//const Buffer = BufferThing.Buffer;

export const encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

/* NOTE: No reason to iterate in this function, because of races.  There
 * will always need to be an "outer" loop. */
var randomName = function( num_chars, encoding, prefix, suffix )
{
    var CHARS_PER_NAME = num_chars | 18;
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
    var WORDS_PER_NAME = Math.ceil( CHARS_PER_NAME / CHARS_PER_WORD );
    var WORDS          = new Uint32Array( WORDS_PER_NAME );

    window.crypto.getRandomValues( WORDS );

    var chars_left     = 0;
    var name           = '';
    var word;

    for( var i = 0; i < CHARS_PER_NAME; i++ )
    {
        if( chars_left < 1 ) {
            word = WORDS[ Math.floor( i / CHARS_PER_WORD ) ];
            chars_left = CHARS_PER_WORD;
        }
        name       += ALPHABET  [ word % NUM_CHARS ];
        word        = Math.floor( word / NUM_CHARS );
        chars_left -= 1;
    }

    return PREFIX + name + SUFFIX;
};

function encodeDecodeFunctions( encoding )
{
    const encoder = new TextEncoder( encoding );
    const decoder = new TextDecoder( encoding );
    return [ encoder.encode.bind( encoder ),
             decoder.decode.bind( decoder ) ];
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

export function typedArrayConcat( a, b )
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

export function isPath( thing )
{
    if( typeof( thing ) === "string" )
        return true;
    if( Array.isArray( thing ) )
        return thing.every( ( p ) => typeof( p ) === "string" );
    return false;
}

export async function handleServerError( msg, resp )
{
    if( resp.status == 404 )
    {
        L.warn( "NOT FOUND ERROR" );
        throw new NotFoundError( msg );
    }
    const t = await resp.text();
    if( resp.status >= 400 && resp.status < 500 )
    {
        L.warn( "REQUEST ERROR" );
        throw new RequestError( msg, resp.statusText + ' ' + t );
    }
    L.warn( "SERVER ERROR" );
    throw new ServerError( msg, resp.statusText + ' ' + t );
}

export function toHexString( byteArray )
{
    return byteArray.reduce(
        ( output, elem ) =>
            ( output + ( '0' + elem.toString( 16 ) ).slice( -2 ) ),
        '' );
}

/* For use with JSON.stringify: */
export function strFromSym( k, v )
{
    if( typeof( v ) === "symbol" )
    {
        const x = Symbol.keyFor( v );
        if( typeof( x ) === "string" )
            return x;
        else
            return String( v );
    }
    else
    {
        return v;
    }
}

export function multiGetter( property_name, default_value, ...objects )
{
    for( const o of objects )
    {
        if( o && property_name in o )
            return o[ property_name ];
    }
    return default_value;
}

export function hasProp( thing, prop )
{
    try {
        return prop in thing;
    }
    catch( err ) {
        return false;
    }
}

export function arrayEq( thing1, thing2 )
{
    if( thing1 === thing2 )
    {
        return true;
    }
    if( thing1.length != thing2.length )
    {
        return false;
    }
    for( var i = 0; i < thing1.length; ++i )
    {
        if( !arrayEq( thing1[ i ], thing2[ i ] ) )
        {
            return false;
        }
    }
    return true;
}

export function nestedArrayFlatten( arr )
{
    return arr.reduce( function( accumulator, item )
    {
        const more = [].concat( item ).some( Array.isArray );
        return accumulator.concat( more ? nestedArrayFlatten( item ) : item );
    }, [] );
}


/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';

