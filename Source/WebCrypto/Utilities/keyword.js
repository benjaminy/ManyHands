/* :name  -or-  :namespace/name  -or-  :namespace.namespace/name  ... */
/* \w may not be the right choice here.  It's fine for now, though. */
keyword_regex = /^:\w+(?:(?:\.\w+)*\/\w+)?$/;
keyword_trie = {};
keyword_intern = {};
keyword_token = Symbol();

/* TODO: Convert from a vanilla trie to a compressed version */
/*
 * k can be one of three things:
 * - A string in keyword format
 *     Look up k in the trie.
 *       If found, just return the keyword object
 *       Otherwise, insert a new keyword object into the global trie and intern table
 * - A symbol
 *     Look up k in the intern table
 * - Already a keyword
 *     In this case, just return k (this is a convenience)
 */
var keyword = function( k )
{
    try {
        if( k.token === keyword_token )
            return k;
    }
    catch( err ) { }

    if( typeof( k ) === 'symbol' )
        return keyword_intern[ k ];

    if( typeof( k ) === 'string' )
    {
        if( !keyword_regex.test( k ) )
            throw new Error( 'Bad keyword format ' + k );
    }
    else
        throw new Error( 'Bad keyword type ' + typeof( k ) );

    var trie = keyword_trie;
    for( var i = 0; i < k.length; i++ )
    {
        if( !trie.hasOwnProperty( k[ i ] ) )
        {
            trie[ k[ i ] ] = {};
        }
        trie = trie[ k[ i ] ];
    }

    if( trie.hasOwnProperty( 'key' ) )
    {
        return trie.key;
    }

    var key = {
        idx   : Symbol();
        str   : k;
        token : keyword_token;
    }

    keyword_intern[ key.idx ] = key;
    trie.key = key;

    return key;
}

var keywordByIdx

var isKeyword = function( k )
{
    try
    {
        return k.token == keyword_token;
    }
    catch( err )
    {
        return false;
    }
}
