var FILE_SERVER_PORT = 8123;
var FILE_SERVER_ADDR = 'http://localhost:'+FILE_SERVER_PORT;

function encode_path( user, path )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    if( !Array.isArray( path ) )
    {
        path = [ path ];
    }
    return { p: path.map( encodeURIComponent ).join( '/' ),
             u: encodeURIComponent( user ) };
}

/* Returns a Promise that either rejects, or fulfills the response object */
function uploadFile( user, path, content, content_type, scp )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    /* assert( typeof( content ) is whatever fetch accepts ) */
    var [ scp, log ] = Scope.enter( scp, 'Upload' );
    var pu = encode_path( user, path );
    var headers = new Headers( { 'Content-Length': '' + content.length } );
    if( content_type )
    {
        headers[ 'Content-Type' ] = content_type;
    }

    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
                  { method  : 'POST',
                    body    : content,
                    headers : headers }
    ).then( function( resp ) {
        var scp = Scope.anon( scp );
        log( 'Response', resp.status, resp.statusText );
        if( !resp.ok )
            return handleServerError( pu.p, resp, scp );
        else
            return P.resolve( resp );
    } );
}

/* Returns a Promise that either rejects, or fulfills the downloaded file's text */
function downloadFile( user, path, isText, scp )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    var [ scp, log ] = Scope.enter( scp, 'Download' );
    var pu = encode_path( user, path );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p
    ).then( function( resp ) {
        var scp = Scope.anon( scp );
        log( pu.p, resp.status, resp.statusText );
        if( !resp.ok )
            return handleServerError( pu.p, resp, scp );
        else
        {
            if( isText )
                return resp.text();
            else
                return resp.arrayBuffer();
        }
    } );
}

function uploadToTeam( cloud, team, scp )
{
    return ( [ p, c, t ] ) =>
        { return uploadFile( cloud, [ 'Teams', team ].concat( p ) , c, t, scp ); }
}

function downloadFromTeam( cloud, team, scp )
{
    return ( [ p, t ] ) =>
        { return downloadFile( cloud, [ 'Teams', team ].concat( p ), t, scp ); }
}
