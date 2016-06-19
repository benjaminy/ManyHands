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
function uploadFile( user, path, content, content_type, log_ctx )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    /* assert( typeof( content ) is whatever fetch accepts ) */
    if( log_ctx ) log_ctx = log_ctx.push( 'Upload' );
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
        log( 'Response', log_ctx, resp.status, resp.statusText );
        if( !resp.ok )
        {
            return new Promise( function( resolve, reject )
            {
                if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        reject( new RequestError( pu.p, resp.statusText + ' ' + t ) );
                    } );
                else
                    resp.text().then( function( t ) {
                        reject( new ServerError( pu.p, resp.statusText + ' ' + t ) );
                    } );
            } );
        }
        else
            return P.resolve( resp );
    } );
}

/* Returns a Promise that either rejects, or fulfills the downloaded file's text */
function downloadFile( user, path, isText, log_ctx )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    if( log_ctx ) log_ctx = log_ctx.push( 'Download' );
    var pu = encode_path( user, path );
    var nf_err = new NotFoundError( pu.p );
    var rq_err = new RequestError( pu.p );
    var sv_err = new ServerError( pu.p );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p
    ).then( function( resp ) {
        log( 'Response', log_ctx, resp.status, resp.statusText, path );
        if( !resp.ok )
        {
            return new Promise( function( resolve, reject )
            {
                if( resp.status == 404 )
                    reject( nf_err );
                else if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        rq_err.server_msg = resp.statusText + ' ' + t;
                        reject( rq_err );
                    } );
                else
                    resp.text().then( function( t ) {
                        sv_err.server_msg = resp.statusText + ' ' + t;
                        reject( sv_err );
                    } );
            } );
        }
        else
        {
            if( isText )
                return resp.text();
            else
                return resp.arrayBuffer();
        }
    } );
}

function uploadToTeam( cloud, team )
{
    return ( [ p, c, t ] ) =>
        { return uploadFile( cloud, [ 'Teams', team ].concat( p ) , c, t ); }
}

function downloadFromTeam( cloud, team )
{
    return ( [ p, t ] ) =>
        { return downloadFile( cloud, [ 'Teams', team ].concat( p ), t ); }
}
