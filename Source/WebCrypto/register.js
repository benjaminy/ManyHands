/*
 *
 */

/* Returns a resolved Promise if successful; a rejected Promise otherwise */
function register( uid, passwd, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'Register' );
    var user = { uid: uid };
    return checkUidAvailability( uid, user, log_ctx )
    .then( function( _ ) {
        return initializeUserAccount( uid, passwd, user, log_ctx );
    } ).then( function( _ ) {
        log( log_ctx, 'Keys initialized' );
        return initializeCloudStorage( user, log_ctx );
    } ).then( function( _ ) {
        log( log_ctx, 'Cloud storage initialized' );
        return submitRegistrationInfo( user, log_ctx );
    } ).then( function( _ ) {
        log( log_ctx, 'Registered' );
        return P.resolve( user );
    } );
}

function checkUidAvailability( uid, user, log_ctx )
{
    log_ctx = log_ctx.push( 'Check' );
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( h ) {
        user.huid = bufToHex( h );
        log( 'HashedUID', log_ctx, user.huid );
        return fetch( '/Users/'+user.huid );
    } ).then( function ( resp ) {
        log( 'Response', log_ctx, resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError() );
        else if( resp.status != 404 )
            return handleServerError( '/Users/'+user.huid, resp );
        else
            return P.resolve();
    } );
}

function initializeUserAccount( uid, passwd, user, log_ctx )
{
    log_ctx = log_ctx.push( 'Init' );
    return P.resolve()
    .then( function() {
        user.login_salt = getRandomBytes( SALT_NUM_BYTES );
        var keys = [ C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] ),
                     C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] ),
                     makeLoginKey( uid, passwd, user.login_salt ) ];
        return P.all( keys )
    } ).then( function( keys ) {
        log( 'GeneratedKeys', log_ctx, keys.map( function( x ){ return typeof( x ); } ) );
        user.key_encrypt = keys[0].publicKey;
        user.key_decrypt = keys[0].privateKey;
        user.key_signing = keys[1].privateKey;
        user.key_verify  = keys[1].publicKey;
        user.key_login   = keys[2];
        return ecdh_aesDeriveKey( user.key_encrypt, user.key_decrypt );
    } ).then( function( k ) {
        log( log_ctx, 'Derived main key', typeof( k ) );
        user.key_main = k;
        function exportKey( k ) {
            return C.exportKey( 'jwk', k ); }
        var keys = [ user.key_encrypt, user.key_decrypt,
                     user.key_signing, user.key_verify,
                     user.key_login, user.key_main ];
        return P.all( keys.map( exportKey ) );
    } ).then( function( keys ) {
        user.key_encrypt_exported = keys[0];
        user.key_decrypt_exported = keys[1];
        user.key_signing_exported = keys[2];
        user.key_verify_exported  = keys[3];
        user.key_login_exported   = keys[4];
        user.key_main_exported    = keys[5];
        return P.resolve();
    } );
}

function initializeCloudStorage( user, log_ctx )
{
    log_ctx = log_ctx.push( 'Cloud' );
    return P.resolve()
    .then( function() {
        user.cloud_bits = getRandomBytes( 5 );
        user.cloud_text = bufToHex( user.cloud_bits );
        log( 'Link', log_ctx, user.cloud_text, user.cloud_bits );
        var dp = aes_cbc_ecdsa.encrypt_then_sign_salted(
            user.key_login, user.key_signing,
            encode( JSON.stringify( user.key_decrypt_exported ) ), log_ctx );
        function encrypt( d )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted(
            user.key_main, user.key_signing, encode( d ), log_ctx ); }
        var to_encrypt = [ JSON.stringify( user.key_signing_exported ), '[]', '{}' ];
        return P.all( to_encrypt.map( encrypt ).concat( [ dp ] ) );
    } ).then( function( [ s, t, i, d ] ) {
        log( log_ctx, 'Exported public keys and encrypted private keys', s, t, i );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        var fs = [ [ 'key_encrypt', JSON.stringify( user.key_encrypt_exported ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( user.key_verify_exported ), 'text/plain' ],
                   [ 'key_decrypt', d ],
                   [ 'key_sign', s ],
                   [ [ 'Teams', 'manifest' ], t ],
                   [ [ 'Invites', 'manifest' ], i ] ]
        return P.all( fs.map( upload ) );
    } );
}

function submitRegistrationInfo( user, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'Submit' );
    log( log_ctx, user.key_login );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        user.key_login, user.key_signing, user.cloud_bits )
    .then( function( l ) {
        log( 'Encrypted link', log_ctx, bufToHex( l ), user.cloud_bits, user.cloud_text );
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
