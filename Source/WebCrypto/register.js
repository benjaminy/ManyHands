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
        user.encrypt_key = keys[0].publicKey;
        user.decrypt_key = keys[0].privateKey;
        user.signing_key = keys[1].privateKey;
        user.verify_key  = keys[1].publicKey;
        user.login_key   = keys[2];
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_key },
            user.decrypt_key, sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        log( log_ctx, 'Derived main key', typeof( k ) );
        user.main_key = k;
        function exportKey( k ) {
            return C.exportKey( 'jwk', k ); }
        var keys = [ user.encrypt_key, user.decrypt_key,
                     user.signing_key, user.verify_key,
                     user.login_key, user.main_key ];
        return P.all( keys.map( exportKey ) );
    } ).then( function( keys ) {
        user.encrypt_key_exported = keys[0];
        user.decrypt_key_exported = keys[1];
        user.signing_key_exported = keys[2];
        user.verify_key_exported  = keys[3];
        user.login_key_exported   = keys[4];
        user.main_key_exported    = keys[5];
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
            user.login_key, user.signing_key,
            encode( JSON.stringify( user.decrypt_key_exported ) ), log_ctx );
        function encrypt( [ d ] )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted( user.main_key, user.signing_key, d ); }
        var to_encrypt = [ [ encode( JSON.stringify( user.signing_key_exported ) ), zeros ],
                           [ encode( '[]' ), zeros ],
                           [ encode( '{}' ), zeros ] ];
        return P.all( to_encrypt.map( encrypt ).concat( [ dp ] ) );
    } ).then( function( [ s, t, i, d ] ) {
        log( log_ctx, 'Exported public keys and encrypted private keys' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        var fs = [ [ 'key_encrypt', JSON.stringify( user.encrypt_key_exported ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( user.verify_key_exported ), 'text/plain' ],
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
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        user.login_key, user.signing_key, user.cloud_bits )
    .then( function( l ) {
        log( 'Encrypted link', log_ctx, bufToHex( l ), user.cloud_bits, user.cloud_text );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: user.verify_key_exported,
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
