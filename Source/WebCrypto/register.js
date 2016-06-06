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
    user.login_salt = getRandomBytes( SALT_NUM_BYTES );
    var keys = [ C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] ),
                 C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] ),
                 makeLoginKey( uid, passwd, user.login_salt ) ];
    return P.all( keys )
    .then( function( keys ) {
        user.encrypt_pair = keys[0];
        user.signing_pair = keys[1];
        user.login_key    = keys[2];
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: keys[0].publicKey },
            keys[0].privateKey, sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        user.main_key = k;
        return P.resolve();
    } );
}

function initializeCloudStorage( user )
{
    user.cloud_bits = getRandomBytes( 5 );
    user.cloud_text = bufToHex( user.cloud_bits );
    log( 'user cloud link:', user.cloud_text, user.cloud_bits );
    var keys = [ C.exportKey( 'jwk', user.encrypt_pair.privateKey ),
                 C.exportKey( 'jwk', user.signing_pair.privateKey ) ];
    return P.all( keys )
    .then( function( [ d, s ] ) {
        var bad_salt = new Uint8Array( 16 );
        log( '[init cloud] Exported private keys' );
        var dp = encrypt_and_sign_ac_ed(
            user.login_key, user.signing_pair.privateKey, encode( JSON.stringify( d ) ),
            bad_salt );
        function encrypt( [ d, s ] )
        { return encrypt_and_sign_ac_ed( user.main_key, user.signing_pair.privateKey, d, s ); }
        var to_encrypt = [ [ encode( JSON.stringify( s ) ), bad_salt ],
                           [ encode( '[]' ), bad_salt ],
                           [ encode( '{}' ), bad_salt ] ];
        var ep = C.exportKey( 'jwk', user.encrypt_pair.publicKey );
        var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
        return P.all( to_encrypt.map( encrypt ).concat( [ dp, ep, vp ] ) );
    } ).then( function( [ s, t, i, d, e, v ] ) {
        log( '[init cloud] Exported public keys and encrypted private keys' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        user.salt = getRandomBytes( 16 );
        var fs = [ [ 'key_encrypt', JSON.stringify( e ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( v ), 'text/plain' ],
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
    var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
    var lp = encrypt_aes_cbc( user.login_salt.slice( 0, 16 ), user.login_key, user.cloud_bits );
    return P.all( [ vp, lp ] )
    .then( function( [ v, l ] ) {
        log( '[Register] Encrypted link', user.cloud_bits, user.cloud_bits.length );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: v,
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
