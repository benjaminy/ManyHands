/*
 * Top Matter
 */

define( function() {
} ); // DELETEME
/*
 *
 */

try {
    console.log( 'Loading keyword module' );
}
catch( err ) {}

const P = Promise;

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

} );
