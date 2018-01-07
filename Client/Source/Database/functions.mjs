
DB.addDbFunction( db, name, params, body )
{
    /* TODO: validate input */
    var f = 'DB.db_functions[ '+name+' ] = function( 'params.join( ',' ) + ' ) { ' + body + ' }';
    /* DEBUG: log f */
    eval( f );
}

DB.callDbFunction();

DB.buildDbFunctionTxn( name, params, body )
{
    /* TODO: validate input */
    datoms = {
        keyword( ':DB/functionName' ) : name;
        keyword( ':DB/functionBody' ) : body;
    }
    params.forEach( function( p ) {
        keyword( ':DB/functionParam' ) : p;
    } );
    return buildMapStmt( 'fn', datoms );
}



