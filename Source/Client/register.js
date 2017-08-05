/*
 * Top Matter
 */

define( [ 'DB', 'crypto-basics' ], function( DB, C ) ) {
} ); // DELETEME

/* Returns a Promise that resolves to the user object */
async function register( uid, passwd )
{
    log( 'Enter', uid );
    // TODO uid sanity check
    // TODO password sanity check
    var user = { uid: uid };
    await checkUidAvailability( uid, user );
    await initializeUserAccount( uid, passwd, user );
    await initializeCloudStorage( user );
    try {
        yield submitRegistrationInfo( scp, user );
    }
    catch( err ) {
        log( 'Registration with central server failed', err );
        // TODO clean up cloud account
    }
    log( 'Exit', uid );
    return user;
}

/*
 * Checks if the desired user name is available at the central server.
 * There could still be a race on the user name, but might as well check
 * before doing all the account init work.
 */
async function checkUidAvailability( uid, user )
{
    user.huid = bufToHex( await C.digest( 'SHA-512', encode( uid ) ) );
    log( 'HashedUID', user.huid, '.  Querying central server ...' );
    var path = '/Users/' + user.huid;
    var resp = await fetch( path );
    log( 'Response', resp.status, resp.statusText );
    if( resp.ok )
        throw new NameNotAvailableError( uid, scp );
    else if( resp.status != 404 )
        handleServerError( scp, path, resp );
    /* seems "user" is available ... */
} );

/* Initializes the necessary components of a user object (mostly keys) */
async function initializeUserAccount( uid, passwd, user )
{
    user.login_salt = getRandomBytes( SALT_NUM_BYTES );
    var keys_dh = await C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
    var keys_sg = await C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    user.key_pub_dh  = keys_dh.publicKey;
    user.key_priv_dh = keys_dh.privateKey;
    user.key_signing = keys_sg.privateKey;
    user.key_verify  = keys_sg.publicKey;
    user.key_login   = await makeLoginKey( uid, passwd, user.login_salt );
    user.key_self    = await generateRandomAesKey();
    user.key_pub_dh_exported  = await exportKeyJwk( user.key_pub_dh );
    user.key_priv_dh_exported = await exportKeyJwk( user.key_priv_dh );
    user.key_signing_exported = await exportKeyJwk( user.key_signing );
    user.key_verify_exported  = await exportKeyJwk( user.key_verify );
    user.key_login_exported   = await exportKeyJwk( user.key_login );
    user.key_self_exported    = await exportKeyJwk( user.key_self );
} );

/*
 * Uploads a user's information to the cloud.
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


    var blob = encode( JSON.stringify( root_obj ) )
    /*...*/ yield encrypt( user.key_login, blob )

    /* private DB txns */
    { ':user.key/verify'  : user.key_verify_exported,
      ':user.key/sign'    : user.key_signing_exported,
      ':user.key/id'      : 1 }
    { ':user.key/dh_priv' : user.key_priv_dh_exported,
      ':user.key/dh_pub'  : user.key_pub_dh_exported,
      ':user.key/id'      : 2 }

    /* public DB txns */
    { ':user.key/verify'  : user.key_verify_exported,
      ':user.key/id'      : 1 }
    { ':user.key/dh_pub'  : user.key_pub_dh_exported,
      ':user.key/id'      : 2 }
    
    root_obj = {
        random_number  : bufToHex( getRandomBytes( 5 ) ),
        public_key     : user.key_verify_exported,
        public_key_idx : 1,
        self_key       : user.key_self,
        self_key_idx   : 3,
        private_db_ptr : ???
        public_db_ptr  : ???
    }

    // sign public keys
    
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
