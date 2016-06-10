/*
 *
 */

/* Returns a resolved Promise if successful; a rejected Promise otherwise */
function register( uid, passwd )
{
    var user = { uid: uid };
    return checkUidAvailability( uid, user )
    .then( function( _ ) {
        return initializeUserAccount( uid, passwd, user );
    } ).then( function( _ ) {
        log( '[Register] Keys initialized' );
        return initializeCloudStorage( user );
    } ).then( function( _ ) {
        log( '[Register] Cloud storage initialized' );
        return submitRegistrationInfo( user );
    } ).then( function( _ ) {
        log( '[Register] Registered' );
        return P.resolve( user );
    } );
}

function checkUidAvailability( uid, user )
{
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( h ) {
        user.huid = bufToHex( h );
        log( '[Register] Hashed uid', user.huid );
        return fetch( '/Users/'+user.huid );
    } ).then( function ( resp ) {
        log( '[Register] uid check', resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError() );
        else if( resp.status != 404 )
            return handleServerError( '/Users/'+user.huid, resp );
        else
            return P.resolve();
    } );
}

function initializeUserAccount( uid, passwd, user )
{
    return P.resolve()
    .then( function() {
        user.login_salt = getRandomBytes( SALT_NUM_BYTES );
        var keys = [ C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] ),
                     C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] ),
                     makeLoginKeys( uid, passwd, user.login_salt ) ];
        return P.all( keys )
    } ).then( function( keys ) {
        log( 'bler', keys[2] );
        user.encrypt_key       = keys[0].publicKey;
        user.decrypt_key       = keys[0].privateKey;
        user.signing_key       = keys[1].privateKey;
        user.verify_key        = keys[1].publicKey;
        user.login_sym         = keys[2][0];
        user.login_sign_verify = keys[2][1];
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_key },
            user.decrypt_key, sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        user.main_key = k;
        function exportKey( k ) {
            log( 'halp', k );
            return C.exportKey( 'jwk', k ); }
        var keys = [ user.encrypt_key, user.decrypt_key,
                     user.signing_key, user.verify_key,
                     user.login_sign_verify, user.login_sym, user.main_key ];
        return P.all( keys.map( exportKey ) );
    } ).then( function( keys ) {
        user.encrypt_key_exported  = keys[0];
        user.decrypt_key_exported  = keys[1];
        user.signing_key_exported  = keys[2];
        user.verify_key_exported   = keys[3];
        user.login_sign_verify_exported = keys[4];
        user.login_sym_exported    = keys[5];
        user.main_key_exported     = keys[6];
        return P.resolve();
    } );
}

function initializeCloudStorage( user )
{
    return P.resolve()
    .then( function() {
        user.cloud_bits = getRandomBytes( 5 );
        user.cloud_text = bufToHex( user.cloud_bits );
        log( '[]user cloud link:', user.cloud_text, user.cloud_bits, user.signing_key, user.login_key );
        var dp = aes_cbc_ecdsa.encrypt_then_sign_salted(
            user.login_key, user.signing_key,
            encode( JSON.stringify( user.decrypt_key_exported ) ) );
        function encrypt( [ d ] )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted( user.main_key, user.signing_key, d ); }
        var to_encrypt = [ [ encode( JSON.stringify( user.signing_key_exported ) ), zeros ],
                           [ encode( '[]' ), zeros ],
                           [ encode( '{}' ), zeros ] ];
        return P.all( to_encrypt.map( encrypt ).concat( [ dp ] ) );
    } ).then( function( [ s, t, i, d ] ) {
        log( '[init cloud] Exported public keys and encrypted private keys' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        user.salt = getRandomBytes( 16 );
        var fs = [ [ 'key_encrypt', JSON.stringify( user.encrypt_key_exported ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( user.verify_key_exported ), 'text/plain' ],
                   [ 'key_decrypt', d ],
                   [ 'key_sign', s ],
                   [ 'salt', user.salt ],
                   [ [ 'Teams', 'manifest' ], t ],
                   [ [ 'Invites', 'manifest' ], i ],
                   [ 'salt', user.salt ] ]
        return P.all( fs.map( upload ) );
    } );
}

function submitRegistrationInfo( user )
{
    var lp = aes_cbc_ecdsa.encrypt_then_sign_salted(
        user.login_sym, user.login_sign, user.cloud_bits );
    return P.resolve( lp )
    .then( function( l ) {
        log( '[Register] Encrypted link', user.cloud_bits, user.cloud_bits.length );
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
