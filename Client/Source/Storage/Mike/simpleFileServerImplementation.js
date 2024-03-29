var FILE_SERVER_PORT = 8080;
var FILE_SERVER_ADDR = 'http://localhost:'+FILE_SERVER_PORT;
var log = console.log.bind( console );

function encode_path( user, path )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    if( !Array.isArray( path ) )
    {
        path = path.split("/");
    }
    return { p: path.map( encodeURIComponent ).join( '/' ),
        u: encodeURIComponent( user ) };
}

var SimpleFileServer = function(userName) {
    this.user = userName;
    CloudStorage.call(this);

    /* Returns a Promise that either rejects, or fulfills the response object */
    this.uploadFile = function( content, path )
    {
        /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
        /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
        /* assert( typeof( user ) == 'string' ) */
        /* assert( typeof( content ) is whatever fetch accepts ) */
        var pu = encode_path( this.user, path );
        var headers = new Headers( { 'Content-Length': '' + content.length } );

        return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
            { method  : 'POST',
                body    : decodeAscii(content),
                headers : headers }
        ).then( function( resp ) {
            log( 'uploadFile response:', resp.status, resp.statusText );
            /* log( 'uploadFile response', resp ); */
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
                return Promise.resolve( resp );
        } );
    };

    /* Returns a Promise that either rejects, or fulfills the downloaded file's text */
    this.downloadFile = function( path ) {
        /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
        /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
        /* assert( typeof( user ) == 'string' ) */
        var pu = encode_path(this.user, path);
        return fetch(FILE_SERVER_ADDR + '/' + pu.u + '/' + pu.p
        ).then(function (resp) {
            log('downloadFile response:', resp.status, resp.statusText);
            if (!resp.ok) {
                return new Promise(function (resolve, reject) {
                    if (resp.status == 404)
                        reject(new NotFoundError(pu.p));
                    else if (resp.status >= 400 && resp.status < 500)
                        resp.text().then(function (t) {
                            reject(new RequestError(pu.p, resp.statusText + ' ' + t));
                        });
                    else
                        resp.text().then(function (t) {
                            reject(new ServerError(pu.p, resp.statusText + ' ' + t));
                        });
                });
            }
            else {
                // TODO: return resp.arrayBuffer();
                return resp.text();
            }
        }).then(function (text) {
            return Promise.resolve(encodeAscii(text));
        });
    };

    this.authenticate = function () {
    };
    
    this.shareFile = function (sharedFileUrl) {
        var pu = encode_path(this.user, sharedFileUrl);
        var linkToResource = new BytableString('/'+pu.u+'/'+pu.p); // we need a Bytable object
        return Promise.resolve(new SharedFile(SimpleFileServer, linkToResource, sharedFileUrl));
    };
    
    this.removeFile = function (filePath) {
        var pu = encode_path(this.user, filePath);
        return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
            { method  : 'DELETE' }
        ).then( function( resp ) {
            log( 'removeFile response:', resp.status, resp.statusText );
            /* log( 'uploadFile response', resp ); */
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
                return Promise.resolve( resp );
        } );
    };

    this.polled = [];
    this.poll = function (filePath) {
        var SFS = this;
        var index = this.polled.findIndex(function(e) {return e.path == filePath;});
        if (index == -1) {
            this.polled.push({path: filePath, stamp: 0 });
            index = this.polled.length-1;
        }
        var stamp = this.polled[index].stamp;

        var pu = encode_path(this.user, filePath);
        var headers = new Headers( { 'Longpoll': '1' , 'Stamp': ''+stamp } );
        return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
            { method  : 'GET',
              headers : headers }
        ).then( function( resp ) {
            log( 'poll response:', resp.status, resp.statusText );
            /* log( 'uploadFile response', resp ); */
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
                return resp.text().then(function(text) {
                    var result = JSON.parse(text);
                    if (result.status == 'change') {
                        SFS.polled[index].stamp = result['stamp'];
                    }
                    return Promise.resolve(result);
                });
        } );
    };
};
SimpleFileServer.prototype = CloudStorage.prototype;

SimpleFileServer.retrieveSharedFile = function (accessData) {
    return fetch( FILE_SERVER_ADDR+accessData
    ).then( function( resp ) {
        log( 'downloadFile response:', resp.status, resp.statusText, accessData );
        if( !resp.ok )
        {
            return new Promise( function( resolve, reject )
            {
                if( resp.status == 404 )
                    reject( new NotFoundError( accessData ) );
                else if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        reject( new RequestError( accessData, resp.statusText + ' ' + t ) );
                    } );
                else
                    resp.text().then( function( t ) {
                        reject( new ServerError( accessData, resp.statusText + ' ' + t ) );
                    } );
            } );
        }
        else
        {
            // TODO: return resp.arrayBuffer();
            return resp.text();
        }
    } ).then( function(text) {
        return Promise.resolve(encodeAscii(text));
    });
};

cloudStorages['SFS'] = SimpleFileServer;

// static properties of CloudStorage:
SimpleFileServer.sharedDataAccessType = BytableString; // indicates the type of accessData
                                                       // in SharedFile constructor
