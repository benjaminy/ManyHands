/*
 *
 */

/* Returns a Promise that resolves to the user object */
var register = async( 'Register', function *( scp, log, uid, passwd )
{
    log( 'Enter', uid );
    var user = { uid: uid };
    yield checkUidAvailability( scp, uid, user );
    yield initializeUserAccount( scp, uid, passwd, user );
    yield initializeCloudStorage( scp, user );
    yield submitRegistrationInfo( scp, user );
    log( 'Exit', uid );
    return user;
} );

/* Checks if the desired user name is available at the central server */
var checkUidAvailability = async( 'Check', function *( scp, log, uid, user )
{
    var h = yield C.digest( 'SHA-256', encode( uid ) );
    user.huid = bufToHex( h );
    log( 'HashedUID', user.huid, '.  Querying central server ...' );
    var path = '/Users/'+user.huid;
    var resp = yield fetch( path );
    log( 'Response', resp.status, resp.statusText );
    if( resp.ok )
        throw new NameNotAvailableError( uid, scp );
    else if( resp.status != 404 )
        handleServerError( scp, path, resp );
} );

/* Initializes the necessary components of a user object (mostly keys) */
var initializeUserAccount = async( 'Init', function *( scp, log, uid, passwd, user )
{
    user.login_salt = getRandomBytes( SALT_NUM_BYTES );
    var keys_dh = yield C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
    var keys_sg = yield C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    user.key_pub_dh  = keys_dh.publicKey;
    user.key_priv_dh = keys_dh.privateKey;
    user.key_signing = keys_sg.privateKey;
    user.key_verify  = keys_sg.publicKey;
    user.key_login   = yield makeLoginKey( uid, passwd, user.login_salt );
    user.key_main    = yield ecdh_aesDeriveKey( user.key_pub_dh, user.key_priv_dh );
    user.key_pub_dh_exported  = yield exportKeyJwk( user.key_pub_dh );
    user.key_priv_dh_exported = yield exportKeyJwk( user.key_priv_dh );
    user.key_signing_exported = yield exportKeyJwk( user.key_signing );
    user.key_verify_exported  = yield exportKeyJwk( user.key_verify );
    user.key_login_exported   = yield exportKeyJwk( user.key_login );
    user.key_main_exported    = yield exportKeyJwk( user.key_main );
} );

/* Uploads a user's information to the cloud.
 * TODO: Currently this code assumes it is uploading a freshly minted user object.
 *   It would be nice to make a more general user info uploader that knew when things
 *   were dirty and needed to be uploaded. */
var initializeCloudStorage = async( 'Cloud', function *( scp, log, user )
{
    user.cloud_bits = getRandomBytes( 5 );
    user.cloud_text = bufToHex( user.cloud_bits );
    log( 'Link', user.cloud_text, user.cloud_bits, '.  Encrypting data ...' );
    function encrypt( k, d )
    { return aes_cbc_ecdsa.encryptThenSignSalted(
        k, user.key_signing, encode( d ), scp ); }
    var key_sign         = yield encrypt( user.key_main, user.key_signing_exported );
    var teams_manifest   = yield encrypt( user.key_main, '[]' );
    var invites_manifest = yield encrypt( user.key_main, '{}' );
    var key_priv_dh      = yield encrypt( user.key_login, user.key_priv_dh_exported );
    log( 'Encrypted a bunch of stuff.  Uploading ...' );
    function upload( [ p, c, t ] ) { return uploadFile( scp, user.cloud_text, p, c, t ) };
    var fs = [ [ 'key_pub_dh', user.key_pub_dh_exported, 'text/plain' ],
               [ 'key_verify',  user.key_verify_exported, 'text/plain' ],
               [ 'key_priv_dh', key_priv_dh ],
               [ 'key_sign', key_sign ],
               [ [ 'Teams', 'manifest' ], teams_manifest ],
               [ [ 'Invites', 'manifest' ], invites_manifest ] ]
    yield P.all( fs.map( upload ) );
} );

/* Submit the necessary user information to the central server */
var submitRegistrationInfo = async( 'Submit', function *( scp, log, user )
{
    log( 'Encrypting cloud link ...' );
    var reg_info = JSON.stringify( {
        link   : bufToHex( yield aes_cbc_ecdsa.encryptThenSignSalted(
            user.key_login, user.key_signing, user.cloud_bits ) ),
        pub_key: user.key_verify_exported,
        salt   : bufToHex( user.login_salt ),
    } );
    var resp = yield fetch( '/Register/'+user.huid,
                  { method  : 'POST',
                    body    : reg_info,
                    headers : new Headers( {
                        'Content-Type':   'text/plain',
                        'Content-Length': '' + reg_info.length
                    } ) } );
    if( !resp.ok )
        handleServerError( scp, '/Users/'+user.huid, resp );
} );
