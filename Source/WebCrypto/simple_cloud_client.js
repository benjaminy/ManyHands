var FILE_SERVER_PORT = 8123;
var loc = window.location;
var FILE_SERVER_ADDR = loc.protocol + '//' + loc.hostname + ':' + FILE_SERVER_PORT;

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
var uploadFile = async( 'Upload', function *( scp, log, user, path, content, content_type )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    /* assert( typeof( content ) is whatever fetch accepts ) */
    var pu = encode_path( user, path );
    var headers = new Headers( { 'Content-Length': '' + content.length } );
    if( content_type )
    {
        headers[ 'Content-Type' ] = content_type;
    }

    var resp = yield fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
                            { method  : 'POST',
                              body    : content,
                              headers : headers } );
    log( 'Response', resp.status, resp.statusText );
    if( !resp.ok )
        return handleServerError( pu.p, resp, scp );
    else
        return P.resolve( resp );
} );

/* Returns a Promise that either rejects, or fulfills the downloaded file's text */
var downloadFile = async( 'Download', function *( scp, log, user, path, isText )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    var pu = encode_path( user, path );
    var resp = yield fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p );
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

function uploadToTeam( cloud, team, scp )
{
    return ( [ p, c, t ] ) =>
        { return uploadFile( scp, cloud, [ 'Teams', team ].concat( p ) , c, t ); }
}

function downloadFromTeam( cloud, team, scp )
{
    return ( [ p, t ] ) =>
        { return downloadFile( scp, cloud, [ 'Teams', team ].concat( p ), t ); }
}
