/*
 *
 */

/* Returns a resolved Promise if successful; a rejected Promise otherwise */
function register( uid, passwd, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Register' );
    var user = { uid: uid };
    return checkUidAvailability( uid, user, scp )
    .then( function() {
        return initializeUserAccount( uid, passwd, user, scp );
    } ).then( function() {
        log( 'Keys initialized' );
        return initializeCloudStorage( user, scp );
    } ).then( function() {
        log( 'Cloud storage initialized' );
        return submitRegistrationInfo( user, scp );
    } ).then( function() {
        log( 'Registered' );
        return P.resolve( user );
    } );
}

function checkUidAvailability( uid, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Check' );
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( h ) {
        user.huid = bufToHex( h );
        log( 'HashedUID', user.huid );
        return fetch( '/Users/'+user.huid );
    } ).then( function ( resp ) {
        log( 'Response', resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError() );
        else if( resp.status != 404 )
            return handleServerError( '/Users/'+user.huid, resp );
        else
            return P.resolve();
    } );
}

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
        log( 'GeneratedKeys', keys.map( function( x ){ return typeof( x ); } ) );
        user.key_encrypt = keys[0].publicKey;
        user.key_decrypt = keys[0].privateKey;
        user.key_signing = keys[1].privateKey;
        user.key_verify  = keys[1].publicKey;
        user.key_login   = keys[2];
        return ecdh_aesDeriveKey( user.key_encrypt, user.key_decrypt );
    } ).then( function( k ) {
        log( 'Derived main key', typeof( k ) );
        user.key_main = k;
        var keys = [ user.key_encrypt, user.key_decrypt,
                     user.key_signing, user.key_verify,
                     user.key_login, user.key_main ];
        return P.all( keys.map( exportKeyJwk ) );
    } ).then( function( keys ) {
        log( 'Exported', typeof( keys[0] ), JSON.stringify( keys[0] ) );
        user.key_encrypt_exported = keys[0];
        user.key_decrypt_exported = keys[1];
        user.key_signing_exported = keys[2];
        user.key_verify_exported  = keys[3];
        user.key_login_exported   = keys[4];
        user.key_main_exported    = keys[5];
        return P.resolve();
    } );
}

function initializeCloudStorage( user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Cloud' );
    return P.resolve()
    .then( function() {
        user.cloud_bits = getRandomBytes( 5 );
        user.cloud_text = bufToHex( user.cloud_bits );
        log( 'Link', user.cloud_text, user.cloud_bits );
        var dp = aes_cbc_ecdsa.encrypt_then_sign_salted(
            user.key_login, user.key_signing,
            encode( user.key_decrypt_exported ), scp );
        function encrypt( d )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted(
            user.key_main, user.key_signing, encode( d ), scp ); }
        var to_encrypt = [ user.key_signing_exported, '[]', '{}' ];
        return P.all( to_encrypt.map( encrypt ).concat( [ dp ] ) );
    } ).then( function( [ s, t, i, d ] ) {
        log( 'Exported public keys and encrypted private keys', s, t, i );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        var fs = [ [ 'key_encrypt', user.key_encrypt_exported, 'text/plain' ],
                   [ 'key_verify',  user.key_verify_exported, 'text/plain' ],
                   [ 'key_decrypt', d ],
                   [ 'key_sign', s ],
                   [ [ 'Teams', 'manifest' ], t ],
                   [ [ 'Invites', 'manifest' ], i ] ]
        return P.all( fs.map( upload ) );
    } );
}

function submitRegistrationInfo( user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Submit' );
    log( user.key_login );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        user.key_login, user.key_signing, user.cloud_bits )
    .then( function( l ) {
        log( 'Encrypted link', bufToHex( l ), user.cloud_bits, user.cloud_text );
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
        if( resp.ok )
            return P.resolve( '' );
        /* 'else' */
        return new Promise( function( resolve, reject )
        {
            var msg = '/Users/'+user.huid+' '+resp.statusText + ' ';
            if( resp.status >= 400 && resp.status < 500 )
                resp.text().then( function( t ) {
                    reject( new RequestError( msg + t ) );
                } );
            else
                resp.text().then( function( t ) {
                    reject( new ServerError( msg + t ) );
                } );
        } );
    } );
}
