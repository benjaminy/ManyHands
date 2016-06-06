/*
 * Current invitation process:
 * 1) A sends cloud link to B
 * 2) B makes a placeholder Team folder,
 *    finds A's public key,
 *    sends cloud link and Team ID to A, all encrypted and signed
 * 3) A makes
 */

function makeInvite( invite_user, team_id, user )
{
    var invite_id   = makeUniqueId( user.invites );
    var invite_salt = getRandomBytes( 16 );
    var step1       = JSON.stringify( { id: invite_user, team: team_id } );
    var ip = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, encode( step1 ), invite_salt );
    var sp = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, invite_salt, new Uint8Array( 16 ) );
    return P.all( [ ip, sp ] )
    .then( function( [ step1, salt ] ) {
        log( '[Invite] Encrypted and signed' );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ step1, 'step1' ], [ salt, 'salt' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[Invite] Uploaded' );
        return P.resolve( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
    } );
}

function inviteAccept( invite_input, user )
{
    var invite      = JSON.parse( invite_input );
    var team_id     = makeUniqueId( user.teams );
    var invite_id   = makeUniqueId( user.invites );
    var invite_salt = getRandomBytes( 16 );
    var debug_k;
    return downloadFile( invite.c, 'key_encrypt', true )
    .then( function( k ) {
        log( '[InviteAccept] Downloaded key' );
        return importKeyEncrypt( k );
    } ).then( function( k ) {
        log( '[InviteAccept] Imported key' );
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        log( '[InviteAccept] Derived key!' );
        var step2 = encode( JSON.stringify( { l: user.cloud_text, t: team_id, i:invite.i } ) );
        var ip = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, step2, invite_salt );
        var sp = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, invite_salt, new Uint8Array( 16 ) );
        debug_k = k;
        return P.all( [ ip, sp ] )
    } ).then( function( [ step2, s ] ) {
        log( '[InviteAccept] Encrypted and signed', s, debug_k, user.signing_pair.publicKey );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ step2, 'step2' ], [ s, 'salt' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[InviteAccept] Uploaded' );
        return P.resolve( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
    } ).catch( function( err ) {
        return unhandledError( 'invite accept', err )
    } );
}

function inviteAddToTeam( invite_input, user )
{
    /* assert( invite_input is valid ) */
    /* assert( user is valid ) */
    var invite = JSON.parse( invite_input );
    function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
    function downloadA( [ p, t ] ) { return downloadFile( user.cloud_text, p, t ) };
    function downloadB( [ p, t ] ) { return downloadFile( invite.c, p, t ) };
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', invite.i, 'step2' ] ],
                  [ [ 'Invites', invite.i, 'salt' ] ] ];
    return P.all( files.map( downloadB ) )
    .then( function( [ encrypt_B, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Downloaded B' );
        return p_all_resolve(
            [ importKeyEncrypt( encrypt_B ), importKeyVerify( verify_B ) ],
            [ step2, salt_B ] );
    } ).then( function( [ encrypt_B, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Imported keys' );
        var ep = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: encrypt_B },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        return p_all_resolve( [ ep ], [ verify_B, step2, salt_B ] );
    } ).then( function( [ sym_AB, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Derived' );
        var sp = verify_and_decrypt_ac_ed( sym_AB, verify_B, new Uint8Array( 16 ), salt_B );
        return p_all_resolve( [ sp ], [ sym_AB, verify_B, step2 ] );
    } ).then( function( [ salt_B, sym_AB, verify_B, step2 ] ) {
        log( '[InviteAdd] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed( sym_AB, verify_B, salt_B, step2 );
        return p_all_resolve( [ ip ], [ sym_AB, verify_B ] );
    } ).then( function( [ step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Decrypted step2', decode( step2 ) );
        step2 = JSON.parse( decode( step2 ) );
        var sp = downloadA( [ [ 'Invites', step2.i, 'salt' ] ] );
        var ip = downloadA( [ [ 'Invites', step2.i, 'step1' ] ] );
        return p_all_resolve( [ ip, sp ], [ step2, sym_AB, verify_B ] );
    } ).then( function( [ step1, salt_A, step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Downloaded A' );
        var sp = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, new Uint8Array( 16 ), salt_A );
        return p_all_resolve( [ sp ], [ step1, step2, sym_AB, verify_B ] );
    } ).then( function( [ salt_A, step1, step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, salt_A, step1 );
        return p_all_resolve( [ ip ], [ salt_A, step2, sym_AB, verify_B ] );
    } ).then( function( [ step1, salt_A, step2, sym_AB, verify_B ] ) {
        step1 = JSON.parse( decode( step1 ) );
        log( '[InviteAdd] Decrypted step1', user, step1 );
        if( !( step1.team in user.teams ) )
        {
            log( 'blah', user.teams );
            return P.reject( 'XXX error' );
        }
        var team = user.teams[ step1.team ];
        log( 'DEBUG' );
        var user_id = makeUniqueId( team.data.teammates );
        var step3 = JSON.stringify( { t: step1.team, u: user_id } );
        var step3p = encrypt_and_sign_ac_ed(
            sym_AB, user.signing_pair.privateKey, encode( step3 ), salt_A );

        team.data.teammates[ user_id ] =
            { uid: step1.id, cloud: invite.c, key: verify_B };
        var data = { name: team_name, teammates: teammates };

        
        console.log( 'really', decode( step1 ) );
        console.log( 'yes', step2 );

    } ).then( function( [ step1, salt_A, step2, sym_AB, verify_B ] ) {

            function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };

    } ).catch( function( err ) {
        return unhandledError( 'invite complete', err );
    } );
}

function inviteJoinTeam( invite, user )
{
    
}
