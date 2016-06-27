/*
 *
 */

/* Returns a Promise that resolves to the user object */
function register( uid, passwd, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Register' );
    var user = { uid: uid };
    log( 'Checking name availability ...' );
    return checkUidAvailability( uid, user, scp )
    .then( function() { var scp = Scope.anon( scp );
        log( 'User name available.  Initializing account information ...' );
        return initializeUserAccount( uid, passwd, user, scp );
    } ).then( function() { var scp = Scope.anon( scp );
        log( 'Account initialized.  Uploading to cloud ...' );
        return initializeCloudStorage( user, scp );
    } ).then( function() { var scp = Scope.anon( scp );
        log( 'Cloud storage initialized.  Submitting registration to central server ...' );
        return submitRegistrationInfo( user, scp );
    } ).then( function() {
        log( 'Registered' );
        return P.resolve( user );
    } );
}

/* Checks if the desired user name is available at the central server */
function checkUidAvailability( uid, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Check' );
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( h ) {
        user.huid = bufToHex( h );
        log( 'HashedUID', user.huid, '.  Fetching info from central server ...' );
        return fetch( '/Users/'+user.huid );
    } ).then( function ( resp ) {
        var scp = Scope.anon( scp );
        log( 'Response', resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError( '', scp ) );
        else if( resp.status != 404 )
            return handleServerError( '/Users/'+user.huid, resp );
        else
            return P.resolve();
    } );
}

/* Initializes the necessary components of a user object (mostly keys) */
function initializeUserAccount( uid, passwd, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Init' );
    return P.resolve()
    .then( function() {
        user.login_salt = getRandomBytes( SALT_NUM_BYTES );
        var keys = [ C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] ),
                     C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] ),
                     makeLoginKey( uid, passwd, user.login_salt ) ];
        return P.all( keys )
    } ).then( function( keys ) {
        log( 'Generated keys.  Deriving main key ...' );
        user.key_pub_dh  = keys[0].publicKey;
        user.key_priv_dh = keys[0].privateKey;
        user.key_signing = keys[1].privateKey;
        user.key_verify  = keys[1].publicKey;
        user.key_login   = keys[2];
        return ecdh_aesDeriveKey( user.key_pub_dh, user.key_priv_dh );
    } ).then( function( k ) {
        log( 'Derived main key.  Exporting keys ...' );
        user.key_main = k;
        var keys = [ user.key_pub_dh, user.key_priv_dh,
                     user.key_signing, user.key_verify,
                     user.key_login, user.key_main ];
        return P.all( keys.map( exportKeyJwk ) );
    } ).then( function( keys ) {
        log( 'Exported keys' );
        user.key_pub_dh_exported  = keys[0];
        user.key_priv_dh_exported = keys[1];
        user.key_signing_exported = keys[2];
        user.key_verify_exported  = keys[3];
        user.key_login_exported   = keys[4];
        user.key_main_exported    = keys[5];
        return P.resolve();
    } );
}

/* Uploads a user's information to the cloud.
 * TODO: Currently this code assumes it is uploading a freshly minted user object.
 *   It would be nice to make a more general user info uploader that knew when things
 *   were dirty and needed to be uploaded. */
function initializeCloudStorage( user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Cloud' );
    return P.resolve()
    .then( function() { var scp = Scope.anon( scp );
        user.cloud_bits = getRandomBytes( 5 );
        user.cloud_text = bufToHex( user.cloud_bits );
        log( 'Link', user.cloud_text, user.cloud_bits, '.  Encrypting data ...' );
        function encrypt( [ k, d ] )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted(
            k, user.key_signing, encode( d ), scp ); }
        var to_encrypt = [ [ user.key_main, user.key_signing_exported ],
                           [ user.key_main, '[]' ],
                           [ user.key_main, '{}' ],
                           [ user.key_login, user.key_priv_dh_exported ] ];
        return P.all( to_encrypt.map( encrypt ) );
    } ).then( function( files ) {
        log( 'Encrypted a bunch of stuff.  Uploading ...' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        var fs = [ [ 'key_pub_dh', user.key_pub_dh_exported, 'text/plain' ],
                   [ 'key_verify',  user.key_verify_exported, 'text/plain' ],
                   [ 'key_priv_dh', files[ 3 ] ],
                   [ 'key_sign', files[ 0 ] ],
                   [ [ 'Teams', 'manifest' ], files[ 1 ] ],
                   [ [ 'Invites', 'manifest' ], files[ 2 ] ] ]
        return P.all( fs.map( upload ) );
    } );
}

/* Submit the necessary user information to the central server */
function submitRegistrationInfo( user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Submit' );
    log( 'Encrypting cloud link ...' );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        user.key_login, user.key_signing, user.cloud_bits )
    .then( function( l ) {
        log( 'Encrypted link' );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: user.key_verify_exported,
            salt   : bufToHex( user.login_salt ),
        };
        var content = JSON.stringify( registration_info );
        return fetch( '/Register/'+user.huid,
            { method  : 'POST',
              body    : content,
              headers : new Headers( {
                  'Content-Type':   'text/plain',
                  'Content-Length': '' + content.length
              } ) } );
    } ).then( function( resp ) {
        var scp = Scope.anon( scp );
        if( resp.ok )
            return P.resolve( '' );
        /* 'else' */
        return handleServerError( '/Users/'+user.huid, resp, scp );
    } );
}
