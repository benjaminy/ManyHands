/*
 * Top Matter
 */

define( function() {

/*
 * Keywords are special strings that are interned in a global structure so that:
 * 1: The same string can be used in different locations to refer to the same object
 * 2: Copies can be stored as pointers (generally smaller than strings)
 * 3: Comparison for (in)equality is very efficient integer comparison
 *
 * By convention, keywords must be of the following format:
 *   :name  -or-  :namespace/name  -or-  :namespace.namespace/name  ...
 * (This format is inherited from Datomic/Clojure)
 *
 * This module exports a single function that takes a single parameter (k),
 * and either returns a keyword object or throws an Error.
 *
 * k can be one of three things:
 * - A string in keyword format
 *     Look up k in the trie.
 *       If found, just return the keyword object
 *       Otherwise, insert a new keyword object into the global trie and intern table
 * - A symbol
 *     Look up k in the intern table
 * - Already a keyword
 *     In this case, just return k (this is a convenience)
 *
 * The object returned has two public fields:
 * - str: This is the keyword's original string
 * - idx: This is a Symbol, which can be used as a key for tables
 */

try {
    console.log( 'Loading keyword module' );
}
catch( err ) {}

/* \w may not be the right choice here.  It's fine for now, though. */
const regex = /^:\w+(?:(?:\.\w+)*\/\w+)?$/;
const root = {};
const intern = {};
const token = Symbol();

return function( k )
{
    try {
        if( k.token === token )
            return k;
    }
    catch( err ) { }

    if( typeof( k ) === 'symbol' )
        return intern[ k ];

    if( typeof( k ) === 'string' )
    {
        if( !regex.test( k ) )
            throw new Error( 'Invalid keyword format ' + k );
    }
    else
        throw new Error( 'Invalid keyword type ' + typeof( k ) );

    // assert( typeof( k === 'string' ) );

    /* TODO: Convert from a plain trie to a compressed version */
    var trie = root;
    for( var i = 0; i < k.length; i++ )
    {
        if( !trie.hasOwnProperty( k[ i ] ) )
        {
            trie[ k[ i ] ] = {};
        }
        trie = trie[ k[ i ] ];
    }

    try {
        return trie.key;
    }
    catch( err ) {}

    const key = {
        idx   : Symbol();
        str   : k;
        token : token;
    }

    intern[ key.idx ] = key;
    trie.key = key;
    return key;
}

} );
